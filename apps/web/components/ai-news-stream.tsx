"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatAiNewsClock, getAiNewsCategoryLabel, groupAiNewsByDay, listAiNewsCategories } from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";

import { aiNewsStreamSnapshot } from "./stream-snapshot";
import { FILTER_REVEAL_COUNT, STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, staggerDelay } from "./motion-tokens";
import { useStreamDate } from "@/components/use-stream-date";
import { useStreamFeed } from "./use-stream-feed";
import { getCurationScrollTarget } from "./curation-scroll";
import { StreamFilterMenu } from "./stream-filter-menu";
import { StreamLoadStatus } from "./stream-skeleton";

export function AiNewsStream({ initialHasMore, initialItems }: {
  initialHasMore: boolean;
  initialItems: AiNewsListItem[];
}) {
  const reduceMotion = useReducedMotion();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // 筛选版本号：> 0 表示列表是筛选后的客户端重挂载，首行阶梯揭示只在这种挂载上播。
  const [filterVersion, setFilterVersion] = useState(0);
  const { appendStart, hasMore, isLoading, items, loadError, loadMore, streamRef } = useStreamFeed<
    AiNewsListItem,
    { activeCategory: string | null },
    HTMLDivElement
  >({
    apiPath: "/api/ai-news",
    pageSize: 50,
    loadErrorMessage: "暂时无法加载更多每日动态。",
    initialHasMore,
    initialItems,
    snapshot: aiNewsStreamSnapshot,
    snapshotExtra: () => ({ activeCategory }),
    onSnapshotRestore: (snapshot) => setActiveCategory(snapshot.activeCategory),
  });

  const selectCategory = (next: string | null) => {
    // 幂等：重复点击当前激活的筛选（含「全部」）不触发任何副作用（滚顶/揭示动画）。
    if (next === activeCategory) return;
    setActiveCategory(next);
    setFilterVersion((version) => version + 1);
  };

  // 筛选后内容整体变了，把滚动位置收回顶部，让逐行揭示从第一行开始可见。
  useEffect(() => {
    if (filterVersion === 0) return;
    const stream = streamRef.current;
    if (!stream) return;
    getCurationScrollTarget(stream).scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [filterVersion, reduceMotion, streamRef]);

  const categories = useMemo(() => listAiNewsCategories(items), [items]);
  const hasSelected = useMemo(() => items.some((item) => item.selected), [items]);
  const itemIndex = useMemo(() => new Map(items.map((item, index) => [item.id, index])), [items]);
  const activeFilterLabel = activeCategory === "selected"
    ? "精选"
    : activeCategory
      ? getAiNewsCategoryLabel(activeCategory)
      : null;
  const groups = useMemo(() => {
    const visible = activeCategory === "selected"
      ? items.filter((item) => item.selected)
      : activeCategory
        ? items.filter((item) => item.category === activeCategory)
        : items;
    return groupAiNewsByDay(visible);
  }, [activeCategory, items]);
  // 筛选揭示用「过滤后展平序列」的序号而非全局索引：加载多页后，某分类的首批条目
  // 全局索引会整体越过 FILTER_REVEAL_COUNT 窗口，用全局索引判定等于静默禁用揭示。
  const filteredIndex = useMemo(() => {
    const index = new Map<string, number>();
    let position = 0;
    for (const group of groups) {
      for (const item of group.items) {
        index.set(item.id, position);
        position += 1;
      }
    }
    return index;
  }, [groups]);

  const visibleDay = useStreamDate(streamRef, groups);

  const visibleGroup = groups.find((group) => (group.dayKey || "unknown") === visibleDay) ?? groups[0];

  if (initialItems.length === 0) {
    return (
      <ol className="curation-home__stream">
        <li aria-live="polite" className="curation-home__stream-status">
          <span>暂时无法获取每日动态，稍后再来看看。</span>
        </li>
      </ol>
    );
  }

  return (
    <div className="ai-news__stream" ref={streamRef}>
      <div className="stream-date-toolbar">
        <div className="ai-news__day-heading">
          <span className="ai-news__day-label">{visibleGroup?.label ?? "每日动态"}</span>
          {visibleGroup ? <span className="ai-news__day-meta">{visibleGroup.weekday} · {visibleGroup.items.length} 条</span> : null}
        </div>
      <StreamFilterMenu
        ariaLabel={`筛选每日动态：${activeFilterLabel ?? "全部动态"}`}
        triggerLabel={activeFilterLabel ?? "全部动态"}
        value={activeCategory ?? "all"}
        options={[
          { value: "all", label: "全部动态" },
          ...(hasSelected ? [{ value: "selected", label: "精选动态" }] : []),
          ...categories.map(({ id, label }) => ({ value: id, label })),
        ]}
        onSelect={(value) => selectCategory(value === "all" ? null : value)}
      />
      </div>

      {/* key 随筛选变化强制整列重挂载，首行阶梯揭示才有机会播放；
          不做整列 FLIP——数百行的位移动画会拉伸刊头、闪出大片空白。 */}
      <div className="ai-news__groups" key={activeCategory ?? "all"}>
        {groups.map((group, groupIndex) => (
        <section aria-label={group.label} className="ai-news__day" data-stream-date={group.dayKey || "unknown"} key={group.dayKey || "unknown"}>
          <h2 className={groupIndex === 0 ? "sr-only" : "ai-news__day-heading"}>
            <span className="ai-news__day-label">{group.label}</span>
            <span className="ai-news__day-meta">
              {group.weekday ? `${group.weekday} · ` : ""}{group.items.length} 条
            </span>
          </h2>
          <ol className="ai-news__timeline">
            {group.items.map((item) => {
              const index = itemIndex.get(item.id) ?? 0;
              const revealIndex = filteredIndex.get(item.id) ?? 0;
              const isAppended = index >= appendStart;
              const isFilterReveal = filterVersion > 0 && revealIndex < FILTER_REVEAL_COUNT;
              const animateMount = !reduceMotion && (isAppended || isFilterReveal);
              const mountDelay = isAppended
                ? staggerDelay(index - appendStart)
                : staggerDelay(revealIndex);
              // 首屏 SSR 与筛选重挂载的非揭示行保持静态；追加行与筛选揭示行播放入场阶梯。
              return (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  initial={animateMount ? { opacity: 0, y: `${STREAM_REVEAL_Y}rem` } : false}
                  key={item.id}
                  transition={{
                    delay: animateMount ? mountDelay : 0,
                    duration: STREAM_REVEAL_DURATION,
                    ease: STREAM_EASE,
                  }}
                >
                  {/* 动态页默认不预取；单条动态内容不可变，显式预取让点击即时打开。 */}
                  <Link className="ai-news__entry" data-content-id={item.id} href={`/ai-news/${item.id}` as Route} prefetch={true}>
                    <div className="ai-news__entry-meta">
                      <time dateTime={item.publishedAt ?? undefined}>{formatAiNewsClock(item.publishedAt)}</time>
                      {/* 登记列只保留出处名；(@handle) 会撑高左栏，详情页仍展示完整出处。 */}
                      <span>{item.sourceName.replace(/\s*\(@[^)]+\)\s*$/, "")}</span>
                      <span>{getAiNewsCategoryLabel(item.category)}</span>
                      {item.selected ? <span>精选</span> : null}
                    </div>
                    <div className="ai-news__entry-copy">
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ol>
        </section>
        ))}
      </div>

      {groups.length === 0 ? (
        <motion.p
          animate={{ opacity: 1 }}
          className="ai-news__empty"
          initial={reduceMotion ? false : { opacity: 0 }}
          transition={{ duration: STREAM_REVEAL_DURATION, ease: STREAM_EASE }}
        >
          这个分类下暂时没有每日动态。
        </motion.p>
      ) : null}

      <div aria-live="polite" className="ai-news__status">
        <span className="sr-only">{activeFilterLabel ? `正在显示${activeFilterLabel}动态` : "正在显示全部动态"}</span>
        <StreamLoadStatus isLoading={isLoading} loadError={loadError} loadMore={loadMore} />
        {!hasMore && !loadError ? (
          <span>{activeFilterLabel ? `已加载全部${activeFilterLabel}动态` : "已加载全部动态"}</span>
        ) : null}
      </div>
    </div>
  );
}
