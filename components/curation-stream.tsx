"use client";

/*
 * 每日关注 · 剪报簿（方向契约，种子 8999beeb）
 * THESIS: 每条目把判断（题名+解析）与证据（原推剪报摘录+附件登记+标签）贴在同一行登记簿里，拒绝"链接列表"式信息流。
 * OWN-WORLD: 沿用全站单色黑白灰与 1px 细线登记栏；剪报只用 1px 左引线与降调灰阶区分"原文声音"，不新增颜色、容器或阴影。
 * STORY: 访客在列表里同时读到他赞了什么与他怎么判断；进详情后原推以样张贴片完整呈现，读完解析顺势翻向相邻剪报。
 * FIRST VIEWPORT: 刊头下第一行即是完整样张——左列登记（收录日期/作者/附件），右列判断标题、解析、剪报摘录、标签行。
 * FORM: 剪报样张（dealt #3；dealt #6 作者回廊、#5 月度合订因削弱判断流主角而落选；auto 模式下代用户锁定）。
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */

import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useRef } from "react";

import { formatCurationClip, formatCurationDate } from "@/lib/curation-format";
import type { CurationListItem } from "@/lib/curation-types";
import { XVideoPlayer } from "@/components/x-video-player";
import { useStreamDate } from "@/components/use-stream-date";

import { STREAM_EASE } from "./motion-tokens";
import { curationStreamSnapshot } from "./stream-snapshot";
import { useStreamFeed } from "./use-stream-feed";

export function CurationStream({
  apiPath = "/api/curation",
  emptyLabel = "暂无已发布的策展条目。",
  initialHasMore,
  initialItems,
  snapshotKey,
  /** 设计收藏在列表内直接呈现可播放视频，详情入口缩为标题链接以避免嵌套交互。 */
  variant = "default",
}: {
  apiPath?: string;
  emptyLabel?: string;
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  /** 会话快照的 sessionStorage key；两个板块各自独立，互不覆盖。 */
  snapshotKey?: string;
  variant?: "default" | "design";
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { appendStart, hasMore, isLoading, items, loadError, loadMore, streamRef } = useStreamFeed<
    CurationListItem,
    Record<never, never>,
    HTMLOListElement
  >({
    apiPath,
    pageSize: 20,
    loadErrorMessage: "暂时无法加载更多策展内容。",
    initialHasMore,
    initialItems,
    snapshot: curationStreamSnapshot,
    storageKey: snapshotKey,
  });
  const visibleDay = useStreamDate(wrapperRef, items);
  const currentDate = visibleDay ?? (items[0] ? formatCurationDate(items[0]) : null);

  return (
    <div ref={wrapperRef}>
      {currentDate ? <div className="stream-date-toolbar">
        <span className="curation-stream__date">{currentDate}</span>
      </div> : null}
    <ol className="curation-home__stream" ref={streamRef}>
      {items.map((item, index) => {
        const isAppended = index >= appendStart;
        const playableMedia = item.media.filter((media) => media.videoUrl);
        // 首屏条目随 SSR 静态输出；只有无限滚动追加的条目播放入场阶梯动画。
        return (
        <motion.li
          animate={isAppended ? { opacity: 1, y: 0 } : undefined}
          initial={isAppended && !reduceMotion ? { opacity: 0, y: "0.45rem" } : false}
          data-stream-date={formatCurationDate(item)}
          key={item.id}
          transition={{
            delay: isAppended ? Math.min(index - appendStart, 9) * 0.032 : 0,
            duration: 0.3,
            ease: STREAM_EASE,
          }}
        >
          {variant === "design" ? (
            <article className="design-curation__entry">
              <div className="curation-home__stream-meta">
                <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
                <span>{`X · @${item.author.handle}`}</span>
                {item.design?.categories.length ? <span>{item.design.categories.join(" · ")}</span> : null}
              </div>
              <div className="curation-home__stream-copy">
                <h3>
                  <Link data-content-id={item.id} href={`/design/${item.id}` as Route}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
                {playableMedia.length > 0 ? (
                  <div className="design-curation__media">
                    {playableMedia.map((media) => (
                      <XVideoPlayer
                        compact
                        isAnimatedGif={media.type === "animated_gif"}
                        itemTitle={item.title}
                        key={media.videoUrl}
                        poster={media.previewUrl ?? media.url}
                        tweetUrl={item.source.url}
                        videoUrl={media.videoUrl!}
                      />
                    ))}
                  </div>
                ) : null}
                {item.text.trim() ? (
                  <blockquote className="curation-home__stream-clip">
                    <p>{formatCurationClip(item.text)}</p>
                  </blockquote>
                ) : null}
                {item.tags.length > 0 ? <p className="curation-home__stream-tags">{item.tags.join(" · ")}</p> : null}
              </div>
            </article>
          ) : (
          <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
            <div className="curation-home__stream-meta">
              <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
              <span>{item.source.platform === "x" ? `X · @${item.author.handle}` : `抖音 · ${item.author.name}`}</span>
              {item.attachments.length > 0 ? <span>{item.attachments.join(" · ")}</span> : null}
            </div>
            <div className="curation-home__stream-copy">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {item.text.trim() ? (
                <blockquote className="curation-home__stream-clip">
                  <p>{formatCurationClip(item.text)}</p>
                </blockquote>
              ) : null}
              {item.tags.length > 0 ? (
                <p className="curation-home__stream-tags">{item.tags.join(" · ")}</p>
              ) : null}
            </div>
          </Link>
          )}
        </motion.li>
        );
      })}
      <li aria-live="polite" className="curation-home__stream-status">
        {isLoading ? (
          <>
            <span className="sr-only">正在加载更多内容</span>
            <div aria-hidden="true" className="curation-home__stream-skeleton">
              <span />
              <span className="is-medium" />
              <span className="is-short" />
            </div>
          </>
        ) : null}
        {loadError ? <button onClick={() => void loadMore()} type="button">{loadError}，重试</button> : null}
        {!hasMore && !loadError ? <span>{items.length === 0 ? emptyLabel : "已加载全部策展内容"}</span> : null}
      </li>
    </ol>
    </div>
  );
}
