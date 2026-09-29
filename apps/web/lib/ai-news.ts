import "server-only";

import { cache } from "react";
import { z } from "zod";

import { aiNewsItemContentSchema } from "@/lib/ai-news-types";
import type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";
import type { AskSource } from "@/lib/ask-types";
import { getPublicSupabaseClient } from "@/lib/supabase.server";
import { getAiNewsArchive } from "@/lib/ai-news-archive.server";
import { archiveMetadata, compareNews, readArchivedItem, readArchivedPage, readPublicRows, searchArchivedItems } from "@site/public-data/ai-news/archive.mjs";

export type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";
export type AiNewsSearchDocument = Omit<AskSource, "scope" | "section"> & { score: number };
export const AI_NEWS_LIST_LIMIT = 50;

function getPublicAiNewsClient() {
  return getPublicSupabaseClient("每日动态增量需要 Supabase 公开投影。");
}

const aiNewsRowSchema = z.object({ content: aiNewsItemContentSchema, selected: z.boolean() });
const aiNewsListRowSchema = aiNewsItemContentSchema.omit({ reason: true, score: true, url: true })
  .extend({ selected: z.boolean() });
const listSelect = "category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title";

// Read changes since this deployment's snapshot, including late arrivals and corrections to old items.
// ponytail: merge the small live window in memory; use a server-side cursor if its volume becomes large.
const readLiveList = cache(async () => z.array(aiNewsListRowSchema).parse(await readPublicRows(getPublicAiNewsClient(), {
  select: listSelect, changedSince: archiveMetadata(getAiNewsArchive()),
})));

export type AiNewsPage = { hasMore: boolean; items: AiNewsListItem[] };

export async function getAiNewsPage(offset = 0, limit = AI_NEWS_LIST_LIMIT): Promise<AiNewsPage> {
  const live = await readLiveList();
  // At most live.length rows can precede an archived row; skip the guaranteed prefix in SQLite.
  const archiveOffset = Math.max(0, offset - live.length);
  const archived = readArchivedPage(getAiNewsArchive(), live.length + limit + 1, live.map((item) => item.id), archiveOffset);
  const start = offset - archiveOffset;
  const items = [...live, ...archived].sort(compareNews).slice(start, start + limit + 1);
  return {
    hasMore: items.length > limit,
    items: items.slice(0, limit).map((item) => aiNewsListRowSchema.parse(item)),
  };
}

export async function getAiNewsSitemapItems() {
  return (await getAiNewsPage(0, 2500)).items.map(({ id, publishedAt }) => ({ id, publishedAt }));
}

export const getAiNewsItem = cache(async (id: string): Promise<AiNewsItem | null> => {
  const archive = getAiNewsArchive();
  const archived = readArchivedItem(archive, id);
  const metadata = archiveMetadata(archive);
  let query = getPublicAiNewsClient().from("ai_news_public_items").select("content,selected").eq("id", id);
  if (archived && metadata) query = query.gte("synced_at", metadata.capturedAt);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`读取 Supabase 每日动态详情失败：${error.message}`);
  if (!data) return archived;
  const row = aiNewsRowSchema.parse(data);
  return { ...row.content, selected: row.selected };
});

const aiNewsSearchRowSchema = z.object({
  id: z.string(), title: z.string(), summary: z.string(), reason: z.string(),
  published_at: z.string().nullable(), score: z.number(),
});

export async function searchAiNewsDocuments(query: string, limit = 6): Promise<AiNewsSearchDocument[]> {
  if (!query.trim()) return [];
  const archive = getAiNewsArchive();
  const client = getPublicAiNewsClient();
  const [changedRows, { data, error }] = await Promise.all([
    readPublicRows(client, { select: "id", changedSince: archiveMetadata(archive) }),
    client.rpc("search_ai_news_public_items", { p_query: query, p_limit: limit }),
  ]);
  if (error) throw new Error(`检索 Supabase 每日动态失败：${error.message}`);
  const changedIds = z.array(z.object({ id: z.string() })).parse(changedRows).map((row) => row.id);
  const archived = searchArchivedItems(archive, query, limit, changedIds);
  const live = z.array(aiNewsSearchRowSchema).parse(data).map((row) => ({ ...row, publishedAt: row.published_at }));
  // Both sources use the same literal occurrence score. Remote versions supersede matching archive ids.
  const merged = new Map([...archived, ...live].map((item) => [item.id, item]));
  return [...merged.values()].filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || compareNews(a, b)).slice(0, limit)
    .map((item) => ({
      content: [item.summary, item.reason].filter(Boolean).join("\n\n"),
      id: `ai-news:${item.id}`, publishedAt: item.publishedAt, score: item.score,
      sourceId: item.id, sourceUrl: `/ai-news/${encodeURIComponent(item.id)}`, title: item.title,
    }));
}
