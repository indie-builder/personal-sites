"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// 冷导航入场只在骨架屏真实绘制过后武装：fallback 存活过双 rAF（绘制了一帧）才记录
// 本次导航路径；缓存命中、立即可用与返回导航都不会留下标记，正文直接呈现。
// 与开机揭幕共用同一套 sessionStorage 成本模型（每会话、读写都容错）。
const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";

export function AiNewsDetailFallbackPainted() {
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(FALLBACK_PAINTED_KEY, window.location.pathname);
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
    let paintedPath: string | null = null;
    try {
      paintedPath = window.sessionStorage.getItem(FALLBACK_PAINTED_KEY);
      window.sessionStorage.removeItem(FALLBACK_PAINTED_KEY);
    } catch {
      paintedPath = null;
    }
    // 标记属于同一次导航才武装淡入。提交内先落暂隐并强制一次样式计算，
    // 让它成为过渡的 before-change，再换 --resolved：正文从 0 淡入且首帧不闪。
    if (paintedPath !== null && paintedPath === window.location.pathname) {
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
