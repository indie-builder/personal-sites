import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { OpenSourceDocumentTabs } from "@/components/open-source-document-tabs";
import { DetailLoadingChrome, DetailPage, DetailTopbar, LoadingDocument } from "@/components/page-shell";
import styles from "@/components/open-source.module.css";
import { canonicalLinks, entryShareMeta } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchOpenSourceEntry } from "@/src/functions/content";

// 与 /curation/$id 一致：首次访问按需生成，随后五分钟内复用页面结果。
export const Route = createFileRoute("/open-source/$slug")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: async ({ params }) => {
    const entry = await fetchOpenSourceEntry({ data: { slug: params.slug } });
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { entry } = loaderData;
    const title = `${entry.repository}｜开源关注`;
    const description = entry.personalNote || entry.repository;
    const canonicalPath = `/open-source/${encodeURIComponent(entry.slug)}`;
    return {
      links: canonicalLinks(canonicalPath),
      meta: [
        { title },
        { name: "description", content: description },
        ...entryShareMeta({ canonicalPath, description, title }).meta,
      ],
    };
  },
  pendingComponent: OpenSourceEntryLoading,
  component: OpenSourceEntryPage,
});

function OpenSourceEntryLoading() {
  return (
    <DetailPage mainClassName="curation-home curation-detail curation-open-source-detail">
      <article aria-busy="true" aria-live="polite" className="curation-detail__article curation-open-source__article">
        <DetailLoadingChrome backLabel="返回开源关注" loadingLabel="正在打开仓库文档" />
        <section aria-label="正在读取中文阅读版" className={`curation-detail__section ${styles.documentSection}`}>
          <div className={styles.documentHeader}>
            <h2 className="curation-detail__eyebrow">仓库文档</h2>
          </div>
          <LoadingDocument />
        </section>
      </article>
    </DetailPage>
  );
}

function OpenSourceEntryPage() {
  const { entry } = Route.useLoaderData();

  return (
    <DetailPage mainClassName="curation-home curation-detail curation-open-source-detail">
      <article className="curation-detail__article curation-open-source__article">
        <DetailTopbar backHref="/open-source" backLabel="返回开源关注" />

        <header className="curation-detail__header">
          <h1>{entry.repository}</h1>
        </header>

        {entry.personalNote ? (
          <section aria-label="判读" className="curation-detail__section curation-detail__note">
            <h2 className="curation-detail__eyebrow">判读</h2>
            <p>{entry.personalNote}</p>
          </section>
        ) : null}

        <OpenSourceDocumentTabs
          parsedMarkdown={entry.parsedMarkdown ?? ""}
          readingSource={entry.readingSource ?? "model-translation"}
          readingSourcePath={entry.readingSourcePath ?? null}
          repository={entry.repository}
          repositoryUrl={entry.repositoryUrl}
          slug={entry.slug}
          sourceUrl={entry.evidence.url}
        />

        <footer aria-label="来源" className="curation-detail__section curation-detail__source">
          <a className="curation-detail__cta" href={entry.repositoryUrl} rel="noreferrer" target="_blank">
            在 GitHub 查看仓库
            <ArrowUpRight aria-hidden="true" />
          </a>
          <span className="curation-detail__cta-host">{new URL(entry.repositoryUrl).host}</span>
        </footer>
      </article>
    </DetailPage>
  );
}
