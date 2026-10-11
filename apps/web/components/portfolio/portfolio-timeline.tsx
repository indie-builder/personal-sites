"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { EASE_OUT, instantMotion, observeMotionPolicy } from "@/lib/portfolio/motion";

import { PlaybackToggle, PreviewPlaybackScope } from "./preview-playback";
import styles from "./portfolio-overview.module.css";

const READING_LINE = 0.35; // 阅读线取视口高的 35vh
const ARRIVAL_MS = 250;

/**
 * 纵向时间轴的轻量追踪器：阅读线落在哪个可见作品上，哪个就是活动站。
 * 只在活动站变化时更新状态；滚动/缩放合并到 rAF，无任何滚动接管或焦点操作。
 */
export function PortfolioTimeline({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stops = [...root.querySelectorAll<HTMLElement>("li[data-timeline-stop]")];
    const works = stops
      .map((stop) => stop.querySelector<HTMLElement>("a[data-portfolio-work]"))
      .filter((work): work is HTMLElement => work !== null);

    // 首次进入视口的到达动效（一次性）；减少动效或键盘操作时立即落在终态。
    const arrivals = new Set<Animation>();
    const stopPolicy = observeMotionPolicy(() => {
      if (!instantMotion() && !document.hidden) return;
      for (const animation of arrivals) animation.finish();
    });
    const playArrival = (work: HTMLElement) => {
      if (instantMotion() || document.hidden) return;
      const animation = work.animate(
        [
          { opacity: 0.75, transform: "translateY(8px)" },
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
    for (const work of works) arrivalObserver.observe(work);

    let frame = 0;
    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const line = viewport * READING_LINE;
      let chosen: HTMLElement | null = null;
      let nearestDistance = Infinity;
      for (const stop of stops) {
        const { top, bottom } = stop.getBoundingClientRect();
        if (bottom <= 0 || top >= viewport) continue;
        const distance = Math.max(top - line, line - bottom, 0);
        if (distance < nearestDistance) {
          chosen = stop;
          nearestDistance = distance;
        }
      }
      const slug = chosen?.dataset.timelineStop ?? null;
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

  // 活动/已读标记直接写 DOM，避免为每个停靠维护 React 状态。
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stops = [...root.querySelectorAll<HTMLElement>("li[data-timeline-stop]")];
    let activeIndex = -1;
    stops.forEach((stop) => {
      if (activeSlug !== null && stop.dataset.timelineStop === activeSlug) {
        activeIndex = stops.indexOf(stop);
        stop.dataset.active = "true";
      } else {
        delete stop.dataset.active;
      }
    });
    stops.forEach((stop, index) => {
      if (activeIndex >= 0 && index <= activeIndex) stop.dataset.seen = "true";
      else delete stop.dataset.seen;
    });
  }, [activeSlug]);

  return (
    <PreviewPlaybackScope activeSlug={activeSlug}>
      <div className={styles.timeline} data-active-station={activeSlug ?? undefined} data-portfolio-timeline ref={rootRef}>
        <div className={styles.utility}>
          <PlaybackToggle />
        </div>
        <div aria-label="作品时间轴" role="region">
          <ol className={styles.list} data-timeline-list>
            {children}
          </ol>
        </div>
      </div>
    </PreviewPlaybackScope>
  );
}
