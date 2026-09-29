import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";

import { DetailPage, DetailTopbar } from "@/components/page-shell";
import { AiNewsRelativeTime } from "@/components/ai-news-relative-time";
import { getAiNewsItem } from "@/lib/ai-news";
import {
  formatAiNewsTime,
  getAiNewsCategoryLabel,
  getAiNewsOriginalAction,
  getAiNewsUrlHost,
} from "@/lib/ai-news-types";
import { entryShareMetadata, withCanonical } from "@/lib/metadata";

import { AiNewsDetailSkeleton } from "./loading";

type AiNewsDetailPageProps = { params: Promise<{ id: string }> };

// 条目发布后基本不可变：ISR 缓存 5 分钟（与上游同步频率一致）。
// 唯一依赖当前时间的是相对时间展示，已移到客户端（AiNewsRelativeTime），
// 不再为它保留整页动态渲染。
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: AiNewsDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await getAiNewsItem(id);
  if (!item) return {};
  const title = `${item.title}｜每日动态`;
  const description = item.summary || item.title;
  const canonicalPath = `/ai-news/${encodeURIComponent(id)}`;
  return {
    alternates: withCanonical(canonicalPath),
    description,
    ...entryShareMetadata({ canonicalPath, description, title }),
    title,
  };
}

export default function AiNewsDetailPage({ params }: AiNewsDetailPageProps) {
  // 壳（个人信息栏）立即渲染，详情数据经 Suspense 补进：缓存未命中时
  // 首字节不等 Supabase 查询，命中后整页静态返回。
  return (
    <DetailPage>
      <Suspense fallback={<AiNewsDetailSkeleton />}>
        <AiNewsDetailContent params={params} />
      </Suspense>
    </DetailPage>
  );
}

async function AiNewsDetailContent({ params }: AiNewsDetailPageProps) {
  const item = await getAiNewsItem((await params).id);
  if (!item) notFound();

  return (
    <article className="ai-news-detail__article" data-content-id={item.id}>
      <DetailTopbar backClassName="ai-news-detail__back" backHref="/ai-news" backLabel="返回每日动态" className="ai-news-detail__topbar" />

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
    </article>
  );
}
