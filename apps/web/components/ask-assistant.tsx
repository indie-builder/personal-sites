"use client";

import { Dialog } from "radix-ui";
import { PanelRightClose, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AssistantSprite, SpriteWalker } from "./assistant-sprite";
import styles from "./ask-assistant.module.css";

const AskChat = dynamic(() => import("./ask-chat").then((module) => module.AskChat), {
  loading: () => <p className={styles.loading} role="status">正在打开问一问…</p>,
});
type Phase = "closed" | "sinking" | "open" | "closing";

export function AskAssistant() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [entered, setEntered] = useState(false);
  const [appearance, setAppearance] = useState(0);
  // ≤900px 时面板是全屏覆盖层：打开时按断点决定模态形态，让 Radix 圈闭
  // 焦点并屏蔽背景；桌面保持非模态侧板（断点与面板 CSS 一致）。判定在打开
  // 时冻结——Radix 按 modal 在两个组件类型间二选一，开着切换会整体重挂
  // Content 子树（丢对话草稿、甩出焦点、重放入场动画），重开才采用新判定。
  const [compact, setCompact] = useState(false);
  const restoreFocusAfterEntry = useRef(false);
  const emergence = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const pageState = useRef<{ canvas: HTMLElement; profile: HTMLElement | null; profileScroll: number } | null>(null);
  const pageMotions = useRef<Array<{ element: HTMLElement; animation: Animation }>>([]);
  const shown = phase === "open" || phase === "closing";

  useEffect(() => {
    if (phase !== "closed") return;
    const element = emergence.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let animation: Animation | undefined;
    const settle = () => {
      if (disposed) return;
      element.style.transform = "translateY(0)";
      animation?.cancel();
      setEntered(true);
    };
    if (reduced.matches) {
      settle();
    } else {
      animation = element.animate([
        { transform: "translateY(calc(100% + 1px))" },
        { transform: "translateY(0)" },
      ], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      // 动画被中断或失败时也要落到最终状态，否则触发按钮会永久禁用。
      animation.finished.then(settle).catch(() => settle());
    }
    const onReducedMotion = () => { if (reduced.matches) settle(); };
    reduced.addEventListener("change", onReducedMotion);
    return () => {
      disposed = true;
      animation?.cancel();
      reduced.removeEventListener("change", onReducedMotion);
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (!entered || !restoreFocusAfterEntry.current) return;
    restoreFocusAfterEntry.current = false;
    trigger.current?.focus({ preventScroll: true });
  }, [entered]);

  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    const canvas = document.getElementById("site-canvas");
    if (!canvas) return;
    const expanded = phase === "open";
    const wasExpanded = document.body.dataset.assistantExpanded === "true";
    if (expanded === wasExpanded && shown === Boolean(pageState.current)) return;

    const profile = trigger.current?.closest<HTMLElement>(".curation-home__profile") ?? null;
    const reading = canvas.querySelector<HTMLElement>(".curation-home__feed, .curation-detail__article");
    // Read the visible position before cancelling an interrupted transition.
    const before = reading?.getBoundingClientRect();
    const scrollTop = pageState.current ? canvas.scrollTop : window.scrollY;
    const profileScroll = pageState.current?.profileScroll ?? profile?.scrollTop ?? 0;
    for (const motion of pageMotions.current) {
      motion.animation.cancel();
      motion.element.style.removeProperty("will-change");
    }
    pageMotions.current = [];

    if (shown) {
      pageState.current ??= { canvas, profile, profileScroll };
      document.body.dataset.assistantOpen = "true";
    } else {
      delete document.body.dataset.assistantOpen;
      pageState.current = null;
    }
    if (expanded) document.body.dataset.assistantExpanded = "true";
    else delete document.body.dataset.assistantExpanded;
    if (shown) canvas.scrollTop = scrollTop;
    else window.scrollTo({ top: scrollTop, behavior: "instant" });
    if (!expanded && profile) profile.scrollTop = profileScroll;

    const after = reading?.getBoundingClientRect();
    const skip = instant || matchMedia("(prefers-reduced-motion: reduce), (max-width: 900px)").matches;
    if (skip || expanded === wasExpanded) return;
    const play = (element: HTMLElement, frames: Keyframe[], duration: number, delay = 0) => {
      element.style.willChange = "transform, opacity";
      const animation = element.animate(frames, {
        duration, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards",
      });
      const motion = { element, animation };
      pageMotions.current.push(motion);
      animation.finished.then(() => {
        if (!pageMotions.current.includes(motion)) return;
        element.style.removeProperty("will-change");
        pageMotions.current = pageMotions.current.filter((item) => item !== motion);
      }).catch(() => {});
    };
    if (reading && before && after) {
      play(reading, [
        { transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)`, opacity: .65 },
        { transform: "translate(0, 0)", opacity: 1 },
      ], 450);
    }
    if (!expanded && profile) {
      play(profile, [{ transform: "translateX(-8px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], 280, 80);
    }
  }, [instant, phase, shown]);

  useLayoutEffect(() => () => {
    for (const motion of pageMotions.current) {
      motion.animation.cancel();
      motion.element.style.removeProperty("will-change");
    }
    const state = pageState.current;
    const top = state?.canvas.scrollTop;
    delete document.body.dataset.assistantOpen;
    delete document.body.dataset.assistantExpanded;
    if (state?.profile) state.profile.scrollTop = state.profileScroll;
    if (top !== undefined) window.scrollTo({ top, behavior: "instant" });
  }, []);

  function close() {
    if (phase === "closing" || phase === "closed") return;
    clearTimeout(timer.current);
    setEntered(false);
    setAppearance((current) => current + 1);
    const skip = instant || matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(skip ? "closed" : "closing");
    if (!skip) timer.current = setTimeout(() => setPhase("closed"), 450);
  }

  return (
    <Dialog.Root modal={compact} open={shown} onOpenChange={(open) => { if (!open) close(); }}>
      <div className={styles.launcher} data-phase={phase} data-instant={instant} data-entered={entered}>
        <SpriteWalker key={appearance} paused={!entered || phase !== "closed"}>
          <button ref={trigger} disabled={!entered} className={styles.trigger} aria-label="和像素助手聊聊" aria-haspopup="dialog" aria-expanded={shown} type="button" onClick={(event) => {
            if (phase !== "closed") return;
            const skip = event.detail === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches;
            setInstant(skip);
            setCompact(matchMedia("(max-width: 900px)").matches);
            setPhase(skip ? "open" : "sinking");
            if (!skip) timer.current = setTimeout(() => setPhase("open"), 300);
          }}>
            <span className={styles.ground}><span className={styles.rise}><span className={styles.emergence} ref={emergence}><AssistantSprite /></span></span></span>
            <span aria-hidden="true" className={styles.tooltip}>和我聊聊</span>
          </button>
        </SpriteWalker>
      </div>
      <Dialog.Portal>
        {/* Radix 1.1 只按 modal 提供焦点圈闭与背景屏蔽行为，不渲染 aria-modal；移动端全屏面板需要显式标注。 */}
        <Dialog.Content aria-modal={compact} className={styles.panel} data-phase={phase} data-instant={instant}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => { event.preventDefault(); document.querySelector<HTMLButtonElement>('[aria-label="关闭问一问"]')?.focus(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current && !trigger.current.disabled) {
              restoreFocusAfterEntry.current = false;
              trigger.current.focus({ preventScroll: true });
            } else restoreFocusAfterEntry.current = true;
          }}>
          <Dialog.Title className="sr-only">问一问</Dialog.Title>
          <Dialog.Description className="sr-only">基于陈远公开资料的 AI 助手</Dialog.Description>
          <button className={styles.close} aria-label="关闭问一问" type="button" onClick={close}><PanelRightClose className={styles.desktopClose} size={16} /><X className={styles.mobileClose} size={20} /></button>
          <AskChat />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
