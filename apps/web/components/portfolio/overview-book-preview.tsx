"use client";

import { useCallback, useRef, useState } from "react";

import { shuffleBooks } from "@/lib/portfolio/book-shuffle";
import { instantMotion, useVisiblePlay } from "@/lib/portfolio/motion";

import { BookSpines } from "./book-spines";
import styles from "./portfolio-overview.module.css";

/** 总览书架只在可见时轮流翻开封面；书架本身不因预览变化（源站首页同款逻辑）。 */
export function OverviewBookPreview({ categories }: { categories: { name: string; count: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(-1);
  const bag = useRef<number[]>([]);
  const current = useRef(-1);
  const onPlay = useCallback(
    (playing: boolean) => {
      setRunning(playing);
      if (playing && current.current === -1) {
        bag.current = shuffleBooks(categories.length);
        current.current = bag.current.shift() ?? -1;
        setActive(current.current);
      }
    },
    [categories.length],
  );
  useVisiblePlay(ref, onPlay);
  function nextBook() {
    if (!running || instantMotion() || document.hidden) return;
    if (!bag.current.length) bag.current = shuffleBooks(categories.length, current.current);
    current.current = bag.current.shift() ?? -1;
    setActive(current.current);
  }
  return (
    <div
      ref={ref}
      className={styles.bookMotion}
      data-running={running}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.bookActive === "true") nextBook();
      }}
    >
      <BookSpines categories={categories} previewActive={active} />
    </div>
  );
}
