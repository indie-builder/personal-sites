"use client";

import { useLayoutEffect } from "react";

import { STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, staggerDelay } from "@/components/motion-tokens";
import {
  hasOpeningPlayedThisSession,
  onOpeningReveal,
} from "@/components/opening-reveal";
import { animate } from "motion/react";

// 「档案摊开」入场：首访仪式揭幕时，刊头与首批内容单元按 32ms 阶梯就位，
// 与内容流追加/筛选揭示共用 0.45rem 上浮 + [0.16,1,0.3,1] 的既有语言。
const revealUnitSelector =
  ":scope .ai-news__day-heading, :scope ol > li:not(.curation-home__stream-status)";
const REVEAL_MAX_UNITS = 6;

function getSectionRevealTargets() {
  const container = document.querySelector<HTMLElement>(".site-section-motion");
  if (!container) return [];
  const targets: HTMLElement[] = [];
  const header = container.querySelector<HTMLElement>(":scope > nav");
  if (header) targets.push(header);
  const units = container.querySelectorAll<HTMLElement>(revealUnitSelector);
  for (const unit of Array.from(units).slice(0, REVEAL_MAX_UNITS)) {
    targets.push(unit);
  }
  return targets;
}

function playSectionReveal(targets: HTMLElement[]) {
  return targets.map((element, index) =>
    animate(
      element,
      { opacity: [0, 1], y: [`${STREAM_REVEAL_Y}rem`, "0rem"] },
      { delay: staggerDelay(index), duration: STREAM_REVEAL_DURATION, ease: STREAM_EASE },
    ),
  );
}

function clearRevealStyles(targets: HTMLElement[]) {
  window.requestAnimationFrame(() => {
    for (const element of targets) {
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
    }
  });
}

export function SectionMotionLifecycle() {
  // 首访仪式的「档案摊开」入场：仅当仪式本会话尚未播放时武装——先把目标藏起，
  // 等 OpeningLoader 揭幕广播后按阶梯播放入场；仪式之外（回访/切版块）完全不参与。
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (hasOpeningPlayedThisSession()) return;
    let targets = getSectionRevealTargets();
    if (targets.length === 0) return;
    // 预藏用 fill:forwards 的 WAAPI 压住：内联 opacity 会被流条目的 motion 组件
    // 在水合时改写，动画效果在合成顺序上压过内联样式，任何目标都不会闪出；
    // 压住一直保持到阶梯全部完成，顺带覆盖各目标的 delay 窗口。
    const holdElement = (element: HTMLElement) =>
      element.animate({ opacity: 0 }, { duration: 1, fill: "forwards" });
    let holds = targets.map(holdElement);

    let animations: ReturnType<typeof playSectionReveal> = [];
    let finished = false;
    const releaseHolds = () => {
      for (const hold of holds) hold.cancel();
    };
    const unsubscribe = onOpeningReveal(() => {
      // Suspense 流式补进的条目在武装时可能尚未入 DOM；揭幕帧补查一次并同帧压住，
      // 此刻帘幕刚起、内容尚未露出，不会出现可见的闪隐。
      const fresh = getSectionRevealTargets();
      const added = fresh.filter((element) => !targets.includes(element));
      if (added.length > 0) {
        holds = holds.concat(added.map(holdElement));
        targets = [...targets, ...added];
      }
      animations = playSectionReveal(targets);
      void Promise.all(
        animations.map((animation) => animation.then(() => undefined, () => undefined)),
      ).then(() => {
        finished = true;
        // 动画结束后撤掉内联样式，终态交还 CSS，元素保持可中断、无残留。
        for (const animation of animations) animation.cancel();
        releaseHolds();
        clearRevealStyles(targets);
      });
    });
    // 兜底：揭幕事件若因异常未到达，恢复静态终态，页面绝不留在隐藏态。
    const failsafe = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      unsubscribe();
      releaseHolds();
      clearRevealStyles(targets);
    }, 10_000);

    return () => {
      unsubscribe();
      window.clearTimeout(failsafe);
      releaseHolds();
      for (const animation of animations) animation.stop();
      if (finished) return;
      for (const element of targets) {
        element.style.removeProperty("opacity");
        element.style.removeProperty("transform");
      }
    };
  }, []);

  return null;
}
