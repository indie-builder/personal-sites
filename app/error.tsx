"use client";

import Link from "next/link";
import { useEffect } from "react";

import { DetailPage, DetailTopbar } from "@/components/page-shell";

// 路由级兜底：数据源或渲染抛错时，避免访客看到框架默认的英文错误页。
// Next 16 起 retry() 会重新请求服务端数据（reset() 只重放已失败的客户端载荷）。
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <DetailPage>
      <article className="ai-news-detail__article">
        <DetailTopbar backClassName="ai-news-detail__back" backHref="/" backLabel="返回首页" className="ai-news-detail__topbar" />
        <header className="ai-news-detail__header">
          <p className="ai-news-detail__kicker ai-news-detail__kicker--error">页面加载失败</p>
          <h1>这页内容暂时读不出来</h1>
        </header>
        <section className="ai-news-detail__section ai-news-detail__lead" role="alert">
          <p>可能是网络波动或数据源暂时不可用，稍候重试通常可以恢复。也可以回到首页继续浏览。</p>
        </section>
        <footer className="ai-news-detail__source">
          <button className="ai-news-detail__cta" onClick={retry} type="button">重试本页</button>
          <Link className="ai-news-detail__cta-host" href="/">返回首页</Link>
        </footer>
      </article>
    </DetailPage>
  );
}
