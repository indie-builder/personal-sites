"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// 冷导航入场只在骨架屏真实绘制过后武装：fallback 存活过双 rAF（绘制了一帧）才记录
// 本次导航的路径、时刻与 Navigation API 条目 id；缓存命中、立即可用与返回导航都不会
// 留下标记，正文直接呈现。标记绑定单次导航尝试：App Router 软导航经 history.pushState
// 铸造新条目，fallback→正文替换发生在同一条目内，而放弃后的重访走新条目、id 不同，
// 3 秒内回来也不淡入（TTL 仅兜底返回键、切走等无条目变化的路径）。无 Navigation API
// 的浏览器条目 id 记为 null，两侧同为 null 时退回仅按路径加时效判定。与开机揭幕共用
// 同一套 sessionStorage 成本模型（每会话、读写都容错）。
// 已知残留：骨架屏绘制后立刻返回、又在 TTL 内前进恢复同一条目时，前进复用原条目
// id，放弃时未消费的标记仍判为同一次导航，正文照常淡入；这一窄残留随 TTL 过期自愈，
// 作为装饰性入场在此明确接受。
//
// 入场只覆盖客户端导航：标记由客户端 effect 写入，而硬导航（直连 URL）的流式
// fallback 在服务端流完成前不会挂载任何客户端生产者，无从写下标记；硬导航因此
// 保持即时换场，不承诺入场淡入。
const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";
const FALLBACK_PAINTED_FRESH_MS = 3000;

type FallbackPaintedMarker = { at: number; path: string; entryId: string | null };

function parsePaintedMarker(raw: string | null): FallbackPaintedMarker | null {
  if (raw === null) return null;
  try {
    const marker = JSON.parse(raw) as Partial<FallbackPaintedMarker>;
    if (typeof marker.path !== "string" || typeof marker.at !== "number") return null;
    return { at: marker.at, path: marker.path, entryId: typeof marker.entryId === "string" ? marker.entryId : null };
  } catch {
    return null;
  }
}

export function AiNewsDetailFallbackPainted() {
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(
            FALLBACK_PAINTED_KEY,
            JSON.stringify({
              at: Date.now(),
              path: window.location.pathname,
              entryId: window.navigation?.currentEntry?.id ?? null,
            }),
          );
        } catch {
          // 存储受限时按未绘制处理，正文直接呈现。
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}

export function AiNewsDetailArticle({ children, contentId }: { children: ReactNode; contentId: string }) {
  const articleRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let marker: FallbackPaintedMarker | null = null;
    try {
      marker = parsePaintedMarker(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY));
      window.sessionStorage.removeItem(FALLBACK_PAINTED_KEY);
    } catch {
      marker = null;
    }
    // 标记属于同一次导航（路径、导航条目 id 都一致）且未超龄才武装淡入。提交内先落
    // 暂隐并强制一次样式计算，让它成为过渡的 before-change，再换 --resolved：正文从
    // 0 淡入且首帧不闪。条目 id 双侧为 null（无 Navigation API）视为一致，退回仅按
    // 路径加时效判定。
    if (
      marker
      && marker.path === window.location.pathname
      && Date.now() - marker.at <= FALLBACK_PAINTED_FRESH_MS
      && marker.entryId === (window.navigation?.currentEntry?.id ?? null)
    ) {
      article.classList.add("ai-news-detail__article--armed");
      void getComputedStyle(article).opacity;
      article.classList.remove("ai-news-detail__article--armed");
      article.classList.add("ai-news-detail__article--resolved");
    }
  }, []);
  return (
    <article className="ai-news-detail__article" data-content-id={contentId} ref={articleRef}>
      {children}
    </article>
  );
}
