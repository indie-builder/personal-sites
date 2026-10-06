"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// 冷导航入场只在骨架屏真实绘制过后武装：fallback 存活过双 rAF（绘制了一帧）才记录
// 本次导航路径与时刻；缓存命中、立即可用与返回导航都不会留下标记，正文直接呈现。
// 标记绑定一次导航尝试：3 秒内未被消费即视为该次导航已被放弃（返回键、切走），
// 之后的缓存重访不再淡入。与开机揭幕共用同一套 sessionStorage 成本模型（每会话、读写都容错）。
//
// 入场只覆盖客户端导航：标记由客户端 effect 写入，而硬导航（直连 URL）的流式
// fallback 在服务端流完成前不会挂载任何客户端生产者，无从写下标记；硬导航因此
// 保持即时换场，不承诺入场淡入。
const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";
const FALLBACK_PAINTED_FRESH_MS = 3000;

type FallbackPaintedMarker = { at: number; path: string };

function parsePaintedMarker(raw: string | null): FallbackPaintedMarker | null {
  if (raw === null) return null;
  try {
    const marker = JSON.parse(raw) as Partial<FallbackPaintedMarker>;
    if (typeof marker.path !== "string" || typeof marker.at !== "number") return null;
    return { at: marker.at, path: marker.path };
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
            JSON.stringify({ at: Date.now(), path: window.location.pathname }),
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
    // 标记属于同一次导航且未超龄才武装淡入。提交内先落暂隐并强制一次样式计算，
    // 让它成为过渡的 before-change，再换 --resolved：正文从 0 淡入且首帧不闪。
    if (
      marker
      && marker.path === window.location.pathname
      && Date.now() - marker.at <= FALLBACK_PAINTED_FRESH_MS
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
