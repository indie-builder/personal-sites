"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { CheckIcon, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef, useState } from "react";

import styles from "@/components/open-source.module.css";
import { useStreamDate } from "@/components/use-stream-date";
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

const FILTER_REVEAL_COUNT = 8;
const FILTER_REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function OpenSourceStream({ entries }: OpenSourceStreamProps) {
  const [category, setCategory] = useState<OpenSourceCategory>("all");
  const [hasFiltered, setHasFiltered] = useState(false);
  const streamRef = useRef<HTMLElement>(null);
  useStreamDate(streamRef, category);
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
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button aria-label={`筛选开源关注：${filterLabel}`} className="ai-news__category-select" type="button">
              <span>{filterLabel}</span><ChevronDown aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={16} className={`ai-news__category-menu ${styles.categoryMenu}`}>
              <DropdownMenu.RadioGroup value={category} onValueChange={(value) => {
                const next = openSourceCategories.find((item) => item.id === value);
                if (!next || next.id === category) return;
                setHasFiltered(true);
                setCategory(next.id);
              }}>
                {openSourceCategories.map((item) => (
                  <DropdownMenu.RadioItem data-slot="dropdown-menu-radio-item" key={item.id} value={item.id}>
                    {item.id === "all" ? "全部主题" : item.label} · {categoryCounts.get(item.id) ?? 0}
                    <span data-slot="dropdown-menu-radio-item-indicator">
                      <DropdownMenu.ItemIndicator><CheckIcon aria-hidden="true" /></DropdownMenu.ItemIndicator>
                    </span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <ol aria-live="polite" className={styles.stream} key={category}>
        {visibleEntries.map((entry, index) => {
          const animateEntry = hasFiltered && !reduceMotion && index < FILTER_REVEAL_COUNT;
          return (
            <motion.li
              animate={animateEntry ? { opacity: 1, y: 0 } : undefined}
              initial={animateEntry ? { opacity: 0, y: "0.5rem" } : false}
              key={entry.slug}
              transition={{
                delay: animateEntry ? index * 0.032 : 0,
                duration: animateEntry ? 0.28 : 0,
                ease: FILTER_REVEAL_EASE,
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
