"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const COLLAPSED_KEY = "personal-site:profile-collapsed";
const READING_SELECTOR = ".curation-home__feed, .curation-detail__article";

/**
 * 桌面沉浸阅读：身份轨默认常驻，只有指针靠近接缝或键盘聚焦时才浮出轻把手。
 * 收起不是新页面——内容仍在原有阅读宽度内居中，左边缘只留一个同样轻的恢复入口。
 */
export function ProfileReadingMode() {
  const [phase, setPhase] = useState<"idle" | "collapsed">("idle");
  const [near, setNear] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const collapsed = phase === "collapsed";
  const restoreFocus = useRef(false);

  useLayoutEffect(() => {
    let saved = false;
    try {
      saved = window.sessionStorage.getItem(COLLAPSED_KEY) === "1";
    } catch { /* 隐私模式：仍可临时收起。 */ }
    if (!saved) return;
    document.body.dataset.profileCollapsed = "true";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 水合后恢复会话内选择，保持 SSR 首屏一致
    setPhase("collapsed");
  }, []);

  useLayoutEffect(() => () => {
    delete document.body.dataset.profileCollapsed;
  }, []);

  // 只在指针靠近左栏接缝的窄带内才浮出把手；离开带子就退回不可见。
  useLayoutEffect(() => {
    if (collapsed) return;
    let timer: number | undefined;
    const onMove = (event: PointerEvent) => {
      const seam = document.querySelector<HTMLElement>(".curation-home__profile");
      if (!seam) return;
      const right = seam.getBoundingClientRect().right;
      const inBand = event.clientX > right - 90 && event.clientX < right + 24;
      if (!inBand) {
        setNear(false);
        return;
      }
      setNear(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setNear(false), 900);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(timer);
    };
  }, [collapsed]);

  const toggle = useCallback(() => {
    const next = !collapsed;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reading = document.querySelector<HTMLElement>(READING_SELECTOR);
    const before = reduced ? null : reading?.getBoundingClientRect();
    if (next) document.body.dataset.profileCollapsed = "true";
    else delete document.body.dataset.profileCollapsed;
    setPhase(next ? "collapsed" : "idle");
    setAnnouncement(next ? "已收起个人简介，正在沉浸阅读" : "已展开个人简介");
    try {
      if (next) window.sessionStorage.setItem(COLLAPSED_KEY, "1");
      else window.sessionStorage.removeItem(COLLAPSED_KEY);
    } catch { /* 只影响下次进页面的默认状态。 */ }
    // 列宽变化后把内容按旧位置平滑归位，避免整列文字瞬间跳格。
    if (!before) return;
    window.requestAnimationFrame(() => {
      const after = reading?.getBoundingClientRect();
      if (!after) return;
      const dx = before.left - after.left;
      if (Math.abs(dx) < 2) return;
      reading?.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }],
        { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
    if (!next) restoreFocus.current = true;
  }, [collapsed]);

  // 展开后把焦点还给把手本身，键盘用户不会丢位置。
  useLayoutEffect(() => {
    if (collapsed || !restoreFocus.current) return;
    restoreFocus.current = false;
    button.current?.focus({ preventScroll: true });
  }, [collapsed]);

  return (
    <>
      <button
        aria-expanded={!collapsed}
        aria-label={collapsed ? "展开左侧个人简介" : "收起左侧个人简介，进入沉浸阅读"}
        title={collapsed ? "展开左侧简介" : "收起左侧简介"}
        className="profile-reading-toggle"
        data-near={near ? "true" : undefined}
        onClick={toggle}
        type="button"
      >
        {/* 接缝夹点：竖线是"这里可以推走"，三角指向收起的去向，不用独立图标。 */}
        <svg aria-hidden="true" viewBox="0 0 10 28">
          <path d="M1.5 5v18" />
          <path className="profile-reading-toggle__arrow" d="M5 10.5 8.2 14 5 17.5" />
        </svg>
      </button>
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </>
  );
}
