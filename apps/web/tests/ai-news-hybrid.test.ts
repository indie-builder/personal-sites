import { Effect } from "effect";
// @vitest-environment node
import { afterAll, expect, it, vi } from "vitest";
import { newsSearchScore, openArchive, readArchivedItem } from "@site/public-data/ai-news/archive.mjs";
import type { AiNewsItem } from "../lib/ai-news-types";

vi.mock("../lib/ai-news-archive.server", () => ({ getAiNewsArchive: () => db }));
vi.mock("../lib/supabase.server", () => ({
  getPublicSupabaseClient: () => ({
    rpc: async (_name: string, { p_query, p_limit }: { p_query: string; p_limit: number }) => ({
      data: live
        .map((row) => ({
          ...row.content,
          published_at: row.content.publishedAt,
          score: newsSearchScore({ ...row.content, selected: row.selected }, p_query),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, p_limit),
      error: null,
    }),
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => {
          const query = {
            gte: () => query,
            maybeSingle: async () => ({ data: live.find((row) => row.id === id) ?? null, error: null }),
          };
          return query;
        },
      }),
    }),
  }),
}));
vi.mock("@site/public-data/ai-news/archive.mjs", async (original) => ({
  ...(await original<typeof import("@site/public-data/ai-news/archive.mjs")>()),
  readPublicRows: vi.fn((_client, options) =>
    Effect.succeed(options?.select ? live.map((row) => ({ ...row.content, selected: row.selected })) : live),
  ),
}));

vi.mock("../lib/public-database", () => ({ getPublicDatabase: () => publicDb }));

const publicDb = openArchive(":memory:", false);
publicDb.exec(`
  CREATE TABLE curation_items (id TEXT, published_at TEXT);
  CREATE TABLE open_source_items (slug TEXT, published_at TEXT);
  INSERT INTO curation_items VALUES ('curation/encoded', NULL);
  INSERT INTO open_source_items VALUES ('owner/repo', '2026-09-21T00:00:00Z');
`);

const db = openArchive(":memory:", false);
const content = (id: string, publishedAt: string | null, title: string): Omit<AiNewsItem, "selected"> => ({
  id,
  publishedAt,
  title,
  category: "ai-models",
  summary: "",
  reason: "",
  score: 90,
  sourceName: "",
  url: `https://example.com/${id}`,
});
const archived = [
  content("old", "2026-09-20T00:00:00Z", "历史模型"),
  content("corrected", "2026-09-28T00:00:00Z", "过期关键词"),
  content("unknown-date", null, "无日期模型"),
];
for (const item of archived)
  db.prepare("INSERT INTO items VALUES (?, ?, ?, ?, 0)").run(
    item.id,
    item.publishedAt,
    "2026-09-28T01:00:00Z",
    JSON.stringify(item),
  );
db.prepare("INSERT INTO archive_meta VALUES (1, ?)").run(
  JSON.stringify({
    cutoff: "2026-09-28T16:00:00.000Z",
    capturedAt: "2026-09-28T20:17:00.000Z",
    digest: "test",
    count: 3,
  }),
);
const live = [
  content("today", "2026-09-29T00:00:00Z", "今天模型"),
  content("late", "2026-09-25T00:00:00Z", "迟到模型"),
  content("corrected", "2026-09-28T00:00:00Z", "修订模型"),
].map((item) => ({ id: item.id, content: item, selected: false }));
afterAll(() => {
  db.close();
  publicDb.close();
});

it("merges archive and live corrections across page boundaries, details, search and sitemap", async () => {
  const { getAiNewsPage, getAiNewsItem, searchAiNewsDocuments } = await import("../lib/ai-news");
  const { getSitemapRecords } = await import("../lib/discovery.server");
  const { SITE_URL } = await import("../lib/site");
  const pages = await Promise.all([
    Effect.runPromise(getAiNewsPage(0, 2)),
    Effect.runPromise(getAiNewsPage(2, 2)),
    Effect.runPromise(getAiNewsPage(4, 2)),
  ]);
  expect(pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
    "today",
    "corrected",
    "late",
    "old",
    "unknown-date",
  ]);
  for (let offset = 0; offset <= 6; offset += 1) {
    const page = await Effect.runPromise(getAiNewsPage(offset, 1));
    expect(page.items.map((item) => item.id)).toEqual(
      ["today", "corrected", "late", "old", "unknown-date"].slice(offset, offset + 1),
    );
  }
  expect(pages.map((page) => page.hasMore)).toEqual([true, true, false]);
  expect(pages[0].items[1].title).toBe("修订模型");
  expect(pages[0].items[0]).not.toHaveProperty("reason");
  expect((await Effect.runPromise(getAiNewsPage(999, 2))).items).toEqual([]);
  expect(await Effect.runPromise(getAiNewsItem("old"))).toEqual(readArchivedItem(db, "old"));
  expect((await Effect.runPromise(getAiNewsItem("corrected")))?.title).toBe("修订模型");
  expect(await Effect.runPromise(getAiNewsItem("missing"))).toBeNull();
  expect(await Effect.runPromise(searchAiNewsDocuments("过期关键词"))).toEqual([]);
  expect((await Effect.runPromise(searchAiNewsDocuments("历史模型")))[0].sourceId).toBe("old");
  expect((await Effect.runPromise(searchAiNewsDocuments("迟到模型")))[0].sourceId).toBe("late");
  expect(await Effect.runPromise(searchAiNewsDocuments("  "))).toEqual([]);
  expect(await Effect.runPromise(getSitemapRecords())).toEqual([
    { url: `${SITE_URL}/ai-news/today`, lastModified: "2026-09-29T00:00:00Z" },
    { url: `${SITE_URL}/ai-news/corrected`, lastModified: "2026-09-28T00:00:00Z" },
    { url: `${SITE_URL}/ai-news/late`, lastModified: "2026-09-25T00:00:00Z" },
    { url: `${SITE_URL}/ai-news/old`, lastModified: "2026-09-20T00:00:00Z" },
    { url: `${SITE_URL}/ai-news/unknown-date`, lastModified: null },
    { url: `${SITE_URL}/curation/curation%2Fencoded`, lastModified: null },
    { url: `${SITE_URL}/open-source/owner%2Frepo`, lastModified: "2026-09-21T00:00:00Z" },
  ]);
});
