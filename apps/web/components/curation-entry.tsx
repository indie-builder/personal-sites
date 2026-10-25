import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play } from "lucide-react";

import { ArticleMarkdown } from "@/components/article-markdown";
import { DetailPage, DetailTopbar } from "@/components/page-shell";
import { XAppLink } from "@/components/x-app-link";
import { XVideoPlayer } from "@/components/x-video-player";
import { formatCurationDate, formatCurationMediaAlt, formatOriginalPublicationDate } from "@/lib/curation-format";
import type { CurationItem } from "@/lib/curation-types";
import { canonicalLinks, entryShareMeta } from "@/lib/metadata";
import type { fetchCurationEntry } from "@/src/functions/content";

type CurationEntryContext = "curation" | "design" | "prompts";

export type CurationEntryData = NonNullable<Awaited<ReturnType<typeof fetchCurationEntry>>>;

/** 板块归属：详情返回链接、页面标题共用同一份解析。 */
const SECTION_BY_CONTEXT: Record<
  CurationEntryContext,
  (item: CurationItem) => {
    backHref: "/curation" | "/design" | "/douyin" | "/prompts";
    backLabel: string;
    label: string;
  }
> = {
  curation: (item) =>
    item.source.platform === "douyin"
      ? { backHref: "/douyin", backLabel: "返回抖音收藏", label: "抖音收藏" }
      : { backHref: "/curation", backLabel: "返回每日关注", label: "每日关注" },
  design: () => ({ backHref: "/design", backLabel: "返回设计收藏", label: "设计收藏" }),
  prompts: () => ({ backHref: "/prompts", backLabel: "返回提示词", label: "提示词" }),
};

/** 把原文里的 t.co 短链替换为可点击的展开后链接。 */
function linkifyText(text: string, links: CurationItem["links"]) {
  const shortToExpanded = new Map(
    links.filter((link) => link.shortUrl).map((link) => [link.shortUrl as string, link.url]),
  );
  return text.split(/(\s+)/u).map((part, index) => {
    const match = /^(https?:\/\/t\.co\/\w+)([.,;:!?）)…]*)$/u.exec(part);
    if (!match) return part;
    const [, shortUrl, suffix] = match;
    return (
      <span key={index}>
        <XAppLink href={shortToExpanded.get(shortUrl) ?? shortUrl}>{shortUrl}</XAppLink>
        {suffix}
      </span>
    );
  });
}

/** 各栏目详情共享条目，canonical 统一指向每日关注的收录 URL。 */
export function buildCurationEntryHead({ context, entry }: { context: CurationEntryContext; entry: CurationEntryData }) {
  const section = SECTION_BY_CONTEXT[context](entry.item);
  const title = `${entry.item.title}｜${section.label}`;
  const canonicalPath = `/curation/${encodeURIComponent(entry.item.id)}`;
  return {
    links: canonicalLinks(canonicalPath),
    meta: [
      { title },
      { name: "description", content: entry.item.summary },
      ...entryShareMeta({ canonicalPath, description: entry.item.summary, title }).meta,
    ],
  };
}

/** 详情页主体：板块差异全部由 context 承载（原 createCurationEntryRoute 的视图半边）。 */
export function CurationEntryView({ context, entry }: { context: CurationEntryContext; entry: CurationEntryData }) {
  const { item, neighbors } = entry;
  const promptItem = item.source.platform === "x" && item.tags.includes("提示词");
  const section = SECTION_BY_CONTEXT[context](item);
  const neighborTo = context === "design" ? "/design/$id" : context === "prompts" ? "/prompts/$id" : "/curation/$id";

  return (
    <DetailPage mainClassName="curation-home curation-detail curation-detail--spread">
      <article className="curation-detail__article" data-content-id={item.id}>
        <DetailTopbar backHref={section.backHref} backLabel={section.backLabel} />

        <header className="curation-detail__header">
          <div className="curation-detail__meta">
            <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
          </div>
          <div className="curation-detail__intro">
            <h1>{item.title}</h1>
            <p>{item.summary}</p>
          </div>
          {item.tags.length > 0 ? (
            <div className="curation-detail__tags">
              {item.tags.map((tag) => promptItem ? (
                <Link key={tag} search={tag === "提示词" ? {} : { tag }} to="/prompts">{tag}</Link>
              ) : (
                <em key={tag}>{tag}</em>
              ))}
            </div>
          ) : null}
        </header>

        <div className="curation-detail__body">
          <section aria-label={promptItem ? "原始内容" : "来源摘录"} className="curation-detail__evidence curation-detail__original">
            <h2 className="curation-detail__eyebrow">{promptItem ? "原始内容" : "来源摘录"}</h2>
            <figure className="curation-detail__specimen">
              <figcaption className="curation-detail__specimen-byline">
                <strong>{item.author.name}</strong>
                {item.source.platform === "x" ? <span>@{item.author.handle}</span> : <span>{item.source.label}</span>}
                <time dateTime={item.publishedAt ?? undefined}>原内容发布于 {formatOriginalPublicationDate(item)}</time>
                {item.excerptTime ? <span>摘录出现于 {item.excerptTime}</span> : null}
              </figcaption>
              <blockquote>
                <p>{linkifyText(item.text, item.links)}</p>
              </blockquote>
              {item.quoteContext ? (
                <blockquote className="curation-detail__quote">
                  <p>{linkifyText(item.quoteContext.text, item.links)}</p>
                  <footer>
                    — @{item.quoteContext.author}（{item.quoteContext.authorName}）的引用原文
                  </footer>
                </blockquote>
              ) : null}
              <CurationMedia media={item.media} sourceUrl={item.source.url} title={item.title} />
            </figure>
          </section>

          <div className="curation-detail__reading">
            {item.prompt?.translation || item.prompt?.quoteTranslation ? (
              <section aria-label="中文译文" className="curation-detail__translation">
                <h2 className="curation-detail__eyebrow">中文译文</h2>
                <p className="curation-detail__translation-note">机器翻译，保留原文供核对。</p>
                {item.prompt.translation ? <p>{item.prompt.translation}</p> : null}
                {item.prompt.quoteTranslation ? <blockquote><p>{item.prompt.quoteTranslation}</p><footer>引用内容译文</footer></blockquote> : null}
              </section>
            ) : null}
            <section aria-label="深度解析">
              <h2 className="curation-detail__eyebrow">深度解析</h2>
              <ArticleMarkdown source={item.analysis} />
            </section>
          </div>
        </div>

        {item.prompt?.replies.length ? (
          <section aria-label="精选追评与案例" className="curation-detail__section curation-detail__replies curation-detail__original">
            <h2 className="curation-detail__eyebrow">精选追评与案例</h2>
            <ol>
              {item.prompt.replies.map((reply) => (
                <li key={reply.id}>
                  <div className="curation-detail__specimen-byline">
                    <strong>{reply.author.name}</strong>
                    <XAppLink href={reply.url}>@{reply.author.handle} · 查看追评 <ArrowUpRight aria-hidden="true" /></XAppLink>
                  </div>
                  <p className="curation-detail__reply-reason">{reply.reason}</p>
                  <p className="curation-detail__reply-text">{linkifyText(reply.text, [])}</p>
                  {reply.translation ? (
                    <div className="curation-detail__translation">
                      <h3 className="curation-detail__eyebrow">中文译文 · 机器翻译</h3>
                      <p>{reply.translation}</p>
                    </div>
                  ) : null}
                  <CurationMedia media={reply.media} sourceUrl={reply.url} title={`${item.title} · 追评案例`} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <footer aria-label="原始链接" className="curation-detail__sources">
          <h2 className="curation-detail__eyebrow">原始来源</h2>
          <ul>
            <li>
              <XAppLink href={item.source.url}>
                {item.source.label}
                {item.source.platform === "x" ? `（@${item.author.handle}）` : `（${item.author.name}）`}
                <ArrowUpRight aria-hidden="true" />
              </XAppLink>
            </li>
            {item.links.map((link) => (
              <li key={link.url}>
                <XAppLink href={link.url}>
                  {link.url}
                  <ArrowUpRight aria-hidden="true" />
                </XAppLink>
              </li>
            ))}
          </ul>
        </footer>

        {neighbors.newer || neighbors.older ? (
          <nav aria-label="相邻剪报" className="curation-detail__neighbors">
            {neighbors.newer ? (
              <Link data-dir="newer" params={{ id: neighbors.newer.id }} to={neighborTo}>
                <span>上一则 · 较新收录</span>
                <strong>{neighbors.newer.title}</strong>
              </Link>
            ) : null}
            {neighbors.older ? (
              <Link data-dir="older" params={{ id: neighbors.older.id }} to={neighborTo}>
                <span>下一则 · 较早收录</span>
                <strong>{neighbors.older.title}</strong>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>
    </DetailPage>
  );
}

function CurationMedia({ media, sourceUrl, title }: { media: CurationItem["media"]; sourceUrl: string; title: string }) {
  if (!media.length) return null;
  return <div className="curation-detail__media">
    {media.map((attachment, index) => attachment.type === "photo" ? (
      <a href={attachment.url} key={attachment.url} rel="noreferrer noopener" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部推文媒体直链 */}
        <img alt={formatCurationMediaAlt(title, index, media.length)} height={attachment.height ?? undefined} loading="lazy" src={attachment.url} width={attachment.width ?? undefined} />
      </a>
    ) : attachment.videoUrl ? (
      <XVideoPlayer isAnimatedGif={attachment.type === "animated_gif"} itemTitle={title} key={attachment.url} poster={attachment.previewUrl ?? attachment.url} tweetUrl={sourceUrl} videoUrl={attachment.videoUrl} />
    ) : (
      <XAppLink className="curation-detail__media-video" href={sourceUrl} key={attachment.url}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部推文媒体直链 */}
        <img alt={formatCurationMediaAlt(title, index, media.length)} height={attachment.height ?? undefined} loading="lazy" src={attachment.previewUrl ?? attachment.url} width={attachment.width ?? undefined} />
        <span><Play aria-hidden="true" />视频内容 · 查看原始来源</span>
      </XAppLink>
    ))}
  </div>;
}
