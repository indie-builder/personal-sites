"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { EASE_OUT, instantMotion, observeMotionPolicy } from "@/lib/portfolio/motion";

import { PlaybackToggle, PreviewPlaybackScope } from "./preview-playback";
import styles from "./portfolio-overview.module.css";

const READING_LINE = 0.35; // 阅读线取视口高的 35vh
const ARRIVAL_MS = 250;

/**
 * 作品模块列表的轻量追踪器：阅读线落在哪个可见模块上，哪个预览获得播放资格。
 * 只写根节点 data-active-preview，模块本身无任何活动态 UI；
 * 滚动/缩放合并到 rAF，无任何滚动接管或焦点操作。
 */
export function PortfolioGallery({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("li[data-portfolio-item]")];

    // 首次进入视口的到达动效（一次性）；减少动效、键盘操作或页面隐藏时立即落在终态。
    const arrivals = new Set<Animation>();
    const stopPolicy = observeMotionPolicy(() => {
      if (!instantMotion() && !document.hidden) return;
      for (const animation of arrivals) animation.finish();
    });
    const playArrival = (item: HTMLElement) => {
      if (instantMotion() || document.hidden) return;
      const animation = item.animate(
        [
          { opacity: 0.75, transform: "translateY(6px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: ARRIVAL_MS, easing: EASE_OUT },
      );
      arrivals.add(animation);
      void animation.finished.then(
        () => arrivals.delete(animation),
        () => arrivals.delete(animation),
      );
    };
    const arrivalObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          arrivalObserver.unobserve(entry.target);
          playArrival(entry.target as HTMLElement);
        }
      },
      { threshold: 0.12 },
    );
    for (const item of items) arrivalObserver.observe(item);

    let frame = 0;
    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const line = viewport * READING_LINE;
      let chosen: HTMLElement | null = null;
      let nearestDistance = Infinity;
      for (const item of items) {
        const { top, bottom } = item.getBoundingClientRect();
        if (bottom <= 0 || top >= viewport) continue;
        const distance = Math.max(top - line, line - bottom, 0);
        if (distance < nearestDistance) {
          chosen = item;
          nearestDistance = distance;
        }
      }
      const slug = chosen?.dataset.portfolioItem ?? null;
      setActiveSlug((current) => (current === slug ? current : slug));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      arrivalObserver.disconnect();
      stopPolicy();
      for (const animation of arrivals) animation.cancel();
    };
  }, []);

  return (
    <PreviewPlaybackScope activeSlug={activeSlug}>
      <div className={styles.gallery} data-active-preview={activeSlug ?? undefined} data-portfolio-gallery ref={rootRef}>
        <div className={styles.utility}>
          <PlaybackToggle />
        </div>
        <div aria-label="作品列表" role="region">
          <ol className={styles.list} data-portfolio-list>
            {children}
          </ol>
        </div>
      </div>
    </PreviewPlaybackScope>
  );
}
