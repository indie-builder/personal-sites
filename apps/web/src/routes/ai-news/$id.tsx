import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { AiNewsRelativeTime } from "@/components/ai-news-relative-time";
import AiNewsDetailLoading from "@/components/ai-news-detail-skeleton";
import { AiNewsDetailArticle } from "@/components/ai-news-detail-entrance";
import { DetailPage, DetailTopbar } from "@/components/page-shell";import {
  formatAiNewsTime,
  getAiNewsCategoryLabel,
  getAiNewsOriginalAction,
  getAiNewsUrlHost,
} from "@/lib/ai-news-types";
import { canonicalLinks, entryShareMeta } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchAiNewsItem } from "@/src/functions/content";

// 条目发布后基本不可变：缓存 5 分钟（与上游同步频率一致）。
// 唯一依赖当前时间的是相对时间展示，已移到客户端（AiNewsRelativeTime）。
export const Route = createFileRoute("/ai-news/$id")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: async ({ params }) => {
    const item = await fetchAiNewsItem({ data: { id: params.id } });
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { item } = loaderData;
    const title = `${item.title}｜每日动态`;
    const description = item.summary || item.title;
    const canonicalPath = `/ai-news/${encodeURIComponent(item.id)}`;
    return {
      links: canonicalLinks(canonicalPath),
      meta: [
        { title },
        { name: "description", content: description },
        ...entryShareMeta({ canonicalPath, description, title }).meta,
      ],
    };
  },
  pendingComponent: AiNewsDetailLoading,
  component: AiNewsDetailPage,
});

function AiNewsDetailPage() {
  const { item } = Route.useLoaderData();

  return (
    <DetailPage>
      <AiNewsDetailArticle contentId={item.id}>
        <DetailTopbar
          backClassName="ai-news-detail__back"
          backHref="/ai-news"
          backLabel="返回每日动态"
          className="ai-news-detail__topbar"
        />

        <header className="ai-news-detail__header">
          <p className="ai-news-detail__kicker">
            {getAiNewsCategoryLabel(item.category)}
            {item.selected ? " · 精选" : ""}
          </p>
          <h1>{item.title}</h1>
          <div className="ai-news-detail__meta">
            <span>{item.sourceName}</span>
            <time dateTime={item.publishedAt ?? undefined}>{formatAiNewsTime(item.publishedAt)}</time>
            <AiNewsRelativeTime publishedAt={item.publishedAt} />
          </div>
        </header>

        {item.summary ? (
          <section aria-label="导读" className="ai-news-detail__section ai-news-detail__lead">
            <h2 className="ai-news-detail__eyebrow">导读</h2>
            <p>{item.summary}</p>
          </section>
        ) : null}

        {item.reason ? (
          <section aria-label="推荐理由" className="ai-news-detail__section ai-news-detail__reason">
            <h2 className="ai-news-detail__eyebrow">推荐理由</h2>
            <p>{item.reason}</p>
          </section>
        ) : null}

        <footer className="ai-news-detail__source">
          <a className="ai-news-detail__cta" href={item.url} rel="noreferrer" target="_blank">
            {getAiNewsOriginalAction(item.url)}
            <ArrowUpRight aria-hidden="true" />
          </a>
          <span className="ai-news-detail__cta-host">{getAiNewsUrlHost(item.url)}</span>
        </footer>
      </AiNewsDetailArticle>
    </DetailPage>
  );
}
