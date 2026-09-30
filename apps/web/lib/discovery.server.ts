import { Effect } from "effect";

import "server-only";

import { Schema } from "effect";

import { getAiNewsPage, getAiNewsSitemapItems } from "@/lib/ai-news";
import { getPublicDatabase } from "@/lib/public-database";
import { SITE_URL } from "@/lib/site";

const datedIdSchema = Schema.Struct({ id: Schema.String, published_at: Schema.NullOr(Schema.String) });
const slugRowSchema = Schema.Struct({ published_at: Schema.String, slug: Schema.String });
const contentRowSchema = Schema.Struct({ content_json: Schema.String, published_at: Schema.NullOr(Schema.String) });

export function getSitemapRecords() {
  return Effect.gen(function* () {
    const database = getPublicDatabase();
    const curation = database
      .prepare("SELECT id, published_at FROM curation_items ORDER BY published_at DESC")
      .all()
      .map((row) => Schema.decodeUnknownSync(datedIdSchema)(row))
      .map((row) => ({ lastModified: row.published_at, url: `${SITE_URL}/curation/${encodeURIComponent(row.id)}` }));
    const openSource = database
      .prepare("SELECT slug, published_at FROM open_source_items ORDER BY published_at DESC")
      .all()
      .map((row) => Schema.decodeUnknownSync(slugRowSchema)(row))
      .map((row) => ({
        lastModified: row.published_at,
        url: `${SITE_URL}/open-source/${encodeURIComponent(row.slug)}`,
      }));
    const aiNews = (yield* getAiNewsSitemapItems()).map((item) => ({
      lastModified: item.publishedAt,
      url: `${SITE_URL}/ai-news/${encodeURIComponent(item.id)}`,
    }));
    return [...aiNews, ...curation, ...openSource];
  });
}

export type FeedItem = { description: string; publishedAt: string | null; title: string; url: string };

export function getFeedItems(limit = 100) {
  return Effect.gen(function* () {
    const database = getPublicDatabase();
    const curation = database
      .prepare("SELECT content_json, published_at FROM curation_items ORDER BY published_at DESC LIMIT 50")
      .all()
      .map((row) => Schema.decodeUnknownSync(contentRowSchema)(row))
      .map((row) => {
        const item = JSON.parse(row.content_json);
        return {
          description: String(item.summary ?? ""),
          publishedAt: row.published_at,
          title: String(item.title ?? ""),
          url: `${SITE_URL}/curation/${encodeURIComponent(String(item.id))}`,
        };
      });
    const openSource = database
      .prepare("SELECT content_json, published_at FROM open_source_items ORDER BY published_at DESC LIMIT 25")
      .all()
      .map((row) => Schema.decodeUnknownSync(contentRowSchema)(row))
      .map((row) => {
        const item = JSON.parse(row.content_json);
        return {
          description: String(item.sourceSummary ?? ""),
          publishedAt: row.published_at,
          title: String(item.repository ?? ""),
          url: `${SITE_URL}/open-source/${encodeURIComponent(String(item.slug))}`,
        };
      });
    const aiNews = (yield* getAiNewsPage(0, 50)).items.map((item) => ({
      description: item.summary,
      publishedAt: item.publishedAt,
      title: item.title,
      url: `${SITE_URL}/ai-news/${encodeURIComponent(item.id)}`,
    }));
    return [...aiNews, ...curation, ...openSource]
      .filter((item) => item.title && item.url)
      .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
      .slice(0, limit);
  });
}
