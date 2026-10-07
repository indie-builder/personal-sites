import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import "server-only";

import { Schema } from "effect";

import { AI_NEWS_PAGE_SIZE, aiNewsItemContentSchema, aiNewsListRowSchema } from "@/lib/ai-news-types";
import { cachedRequest } from "@/lib/cached-request";
import { getPublicSupabaseClient } from "@/lib/supabase.server";
import { getAiNewsArchive } from "@/lib/ai-news-archive.server";
import {
  archiveMetadata,
  compareNews,
  readArchivedItem,
  readArchivedPage,
  readPublicRows,
  searchArchivedItems,
} from "@site/public-data/ai-news/archive.mjs";

function getPublicAiNewsClient() {
  return getPublicSupabaseClient("每日动态增量需要 Supabase 公开投影。");
}

const aiNewsRowSchema = Schema.Struct({ content: aiNewsItemContentSchema, selected: Schema.Boolean });
const listSelect =
  "category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title";

// Read changes since this deployment's snapshot, including late arrivals and corrections to old items.
// ponytail: merge the small live window in memory; use a server-side cursor if its volume becomes large.
const readLiveList = cachedRequest(() =>
  Effect.gen(function* () {
    const client = yield* attempt("ai-news.client", getPublicAiNewsClient);
    const metadata = yield* attempt("ai-news.archive", () => archiveMetadata(getAiNewsArchive()));
    const rows = yield* readPublicRows(client, { select: listSelect, changedSince: metadata });
    return yield* Schema.decodeUnknownEffect(Schema.Array(aiNewsListRowSchema).pipe(Schema.mutable))(rows);
  }),
);

export function getAiNewsPage(offset = 0, limit = AI_NEWS_PAGE_SIZE) {
  return Effect.gen(function* () {
    const live = yield* readLiveList();
    // At most live.length rows can precede an archived row; skip the guaranteed prefix in SQLite.
    const archiveOffset = Math.max(0, offset - live.length);
    const archived = yield* attempt("ai-news.page", () =>
      readArchivedPage(
        getAiNewsArchive(),
        live.length + limit + 1,
        live.map((item) => item.id),
        archiveOffset,
      ),
    );
    const start = offset - archiveOffset;
    const items = [...live, ...archived].sort(compareNews).slice(start, start + limit + 1);
    return {
      hasMore: items.length > limit,
      items: yield* Schema.decodeUnknownEffect(Schema.Array(aiNewsListRowSchema).pipe(Schema.mutable))(items.slice(0, limit)),
    };
  });
}

export const getAiNewsItem = cachedRequest((id: string) =>
  Effect.gen(function* () {
    const archive = yield* attempt("ai-news.archive", getAiNewsArchive);
    const archived = yield* attempt("ai-news.item", () => readArchivedItem(archive, id));
    const metadata = yield* attempt("ai-news.metadata", () => archiveMetadata(archive));
    const client = yield* attempt("ai-news.client", getPublicAiNewsClient);
    let query = client.from("ai_news_public_items").select("content,selected").eq("id", id);
    if (archived && metadata) query = query.gte("synced_at", metadata.capturedAt);
    const { data, error } = yield* io("ai-news.detail", () => query.maybeSingle());
    if (error) return yield* Effect.fail(new Error(`读取 Supabase 每日动态详情失败：${error.message}`));
    if (!data) return archived;
    const row = yield* Schema.decodeUnknownEffect(aiNewsRowSchema)(data);
    return { ...row.content, selected: row.selected };
  }),
);

const aiNewsSearchRowSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  summary: Schema.String,
  reason: Schema.String,
  published_at: Schema.NullOr(Schema.String),
  score: Schema.Number.check(Schema.isFinite()),
});

export function searchAiNewsDocuments(query: string, limit = 6) {
  return Effect.gen(function* () {
    if (!query.trim()) return [];
    const archive = yield* attempt("ai-news.archive", getAiNewsArchive);
    const client = yield* attempt("ai-news.client", getPublicAiNewsClient);
    const [changedRows, { data, error }] = yield* Effect.all(
      [
        readPublicRows(client, { select: "id", changedSince: archiveMetadata(archive) }),
        io("ai-news.search", () => client.rpc("search_ai_news_public_items", { p_query: query, p_limit: limit })),
      ],
      { concurrency: 2 },
    );
    if (error) return yield* Effect.fail(new Error(`检索 Supabase 每日动态失败：${error.message}`));
    const changedIds = (yield* Schema.decodeUnknownEffect(
      Schema.Array(Schema.Struct({ id: Schema.String })).pipe(Schema.mutable),
    )(changedRows)).map((row) => row.id);
    const archived = yield* attempt("ai-news.searchArchive", () =>
      searchArchivedItems(archive, query, limit, changedIds),
    );
    const live = (yield* Schema.decodeUnknownEffect(Schema.Array(aiNewsSearchRowSchema).pipe(Schema.mutable))(data)).map(
      (row) => ({ ...row, publishedAt: row.published_at }),
    );
    // Both sources use the same literal occurrence score. Remote versions supersede matching archive ids.
    const merged = new Map([...archived, ...live].map((item) => [item.id, item]));
    return [...merged.values()]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || compareNews(a, b))
      .slice(0, limit)
      .map((item) => ({
        content: [item.summary, item.reason].filter(Boolean).join("\n\n"),
        id: `ai-news:${item.id}`,
        publishedAt: item.publishedAt,
        score: item.score,
        sourceId: item.id,
        sourceUrl: `/ai-news/${encodeURIComponent(item.id)}`,
        title: item.title,
      }));
  });
}
