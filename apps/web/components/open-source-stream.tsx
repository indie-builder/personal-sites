"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { FILTER_REVEAL_COUNT, STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, staggerDelay } from "@/components/motion-tokens";
import styles from "@/components/open-source.module.css";
import { useStickyToolbarOffset } from "@/components/use-stream-date";
import { StreamFilterMenu } from "@/components/stream-filter-menu";
import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  type OpenSourceCategory,
  type OpenSourceListEntry,
} from "@/lib/open-source-types";

type OpenSourceStreamProps = {
  entries: OpenSourceListEntry[];
};

export function OpenSourceStream({ entries }: OpenSourceStreamProps) {
  const [category, setCategory] = useState<OpenSourceCategory>("all");
  const [hasFiltered, setHasFiltered] = useState(false);
  const streamRef = useRef<HTMLElement>(null);
  useStickyToolbarOffset(streamRef);
  const reduceMotion = useReducedMotion();
  const categoryCounts = new Map<OpenSourceCategory, number>(
    openSourceCategories.map((item) => [item.id, item.id === "all" ? entries.length : 0]),
  );

  for (const entry of entries) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
  }

  const visibleEntries = category === "all"
    ? entries
    : entries.filter((entry) => entry.category === category);
  const filterLabel = category === "all" ? "全部主题" : getOpenSourceCategoryLabel(category);

  return (
    <section aria-label="已判读的开源项目" className={styles.streamSection} ref={streamRef}>
      <div className="stream-date-toolbar">
        <span className="curation-stream__date">{visibleEntries.length} 个项目</span>
        <StreamFilterMenu
          ariaLabel={`筛选开源关注：${filterLabel}`}
          triggerLabel={filterLabel}
          value={category}
          options={openSourceCategories.map((item) => ({
            value: item.id,
            label: `${item.id === "all" ? "全部主题" : item.label} · ${categoryCounts.get(item.id) ?? 0}`,
          }))}
          onSelect={(value) => {
            const next = openSourceCategories.find((item) => item.id === value);
            if (!next || next.id === category) return;
            setHasFiltered(true);
            setCategory(next.id);
          }}
          menuClassName={styles.categoryMenu}
        />
      </div>

      <ol aria-live="polite" className={styles.stream} key={category}>
        {visibleEntries.map((entry, index) => {
          const animateEntry = hasFiltered && !reduceMotion && index < FILTER_REVEAL_COUNT;
          return (
            <motion.li
              animate={animateEntry ? { opacity: 1, y: 0 } : undefined}
              initial={animateEntry ? { opacity: 0, y: `${STREAM_REVEAL_Y}rem` } : false}
              key={entry.slug}
              transition={{
                delay: animateEntry ? staggerDelay(index) : 0,
                duration: animateEntry ? STREAM_REVEAL_DURATION : 0,
                ease: STREAM_EASE,
              }}
            >
              <Link href={`/open-source/${entry.slug}`}>
                <div className={styles.meta}>
                  <span>{getOpenSourceCategoryLabel(entry.category)}</span>
                  <span>{entry.status}</span>
                </div>
                <div className={styles.copy}>
                  <h2>{entry.repository}</h2>
                  <p className={styles.source}>{entry.sourceSummary}</p>
                  <div className={styles.tags}>
                    <span>{getOpenSourceDimensionLabel(entry.dimensions[0])}</span>
                    <span>{entry.type}</span>
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ol>
      {visibleEntries.length === 0 ? <p className={styles.empty}>暂时没有符合当前筛选的已公开仓库。</p> : null}
    </section>
  );
}
