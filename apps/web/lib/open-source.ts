import { Effect } from "effect";
import { attempt } from "@site/effect";
import "server-only";

import { Schema } from "effect";

import { cachedRequest } from "@/lib/cached-request";
import { openSourceEntrySchema } from "@/lib/open-source-schema";
import { toOpenSourceListEntry } from "@/lib/open-source-types";
import type { OpenSourceEntry } from "@/lib/open-source-types";
import { contentJsonRowSchema, getPublicDatabase } from "@/lib/public-database";

function parseEntry(contentJson: string): OpenSourceEntry {
  return Schema.decodeUnknownSync(openSourceEntrySchema)(JSON.parse(contentJson));
}

export function getOpenSourceListEntries() {
  return attempt("getOpenSourceListEntries", () =>
    getPublicDatabase()
      .prepare("SELECT content_json FROM open_source_items ORDER BY display_rank ASC, published_at DESC")
      .all()
      .map((row) => Schema.decodeUnknownSync(contentJsonRowSchema)(row))
      .map((row) => toOpenSourceListEntry(parseEntry(row.content_json))),
  );
}

// /api/open-source 的分页读取：策展集合小（当前 10 条），直接整表切片，
// 响应契约与其余信息流接口一致（{ hasMore, items }）。
export function getOpenSourcePage(offset = 0, limit = 20) {
  return Effect.gen(function* () {
    const entries = yield* getOpenSourceListEntries();
    return {
      hasMore: offset + limit < entries.length,
      items: entries.slice(offset, offset + limit),
    };
  });
}

export const getOpenSourceEntry = cachedRequest((slug: string) =>
  attempt("open-source.detail", () => {
    if (!/^[\w-]+$/u.test(slug)) return null;
    const row = getPublicDatabase().prepare("SELECT content_json FROM open_source_items WHERE slug = ?").get(slug);
    return row ? parseEntry(Schema.decodeUnknownSync(contentJsonRowSchema)(row).content_json) : null;
  }),
);
