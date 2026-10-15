import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { DetailPage, DetailTopbar } from "@/components/page-shell";

// 路由级兜底：数据源或渲染抛错时，避免访客看到框架默认的英文错误页。
// reset() 只重放边界；invalidate() 让失败的 loader 重新请求服务端数据，两者都要做。
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

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
          <button
            className="ai-news-detail__cta"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            type="button"
          >
            重试本页
          </button>
          <Link className="ai-news-detail__cta-host" to="/">返回首页</Link>
        </footer>
      </article>
    </DetailPage>
  );
}

export function RouteNotFound() {
  return (
    <DetailPage>
      <article className="ai-news-detail__article">
        <DetailTopbar backClassName="ai-news-detail__back" backHref="/" backLabel="返回首页" className="ai-news-detail__topbar" />
        <header className="ai-news-detail__header">
          <p className="ai-news-detail__kicker">404 · 页面未找到</p>
          <h1>这页档案不在这里</h1>
        </header>
        <section className="ai-news-detail__section ai-news-detail__lead">
          <p>链接可能已经变更，或这份内容尚未公开。可以回到首页，继续阅读最新动态。</p>
        </section>
        <footer className="ai-news-detail__source">
          <Link className="ai-news-detail__cta" to="/ai-news">阅读每日动态</Link>
        </footer>
      </article>
    </DetailPage>
  );
}
