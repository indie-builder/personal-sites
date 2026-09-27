import "server-only";

import { cache } from "react";
import { z } from "zod";

import { openSourceEntrySchema } from "@/lib/open-source-schema";
import { toOpenSourceListEntry } from "@/lib/open-source-types";
import type { OpenSourceEntry, OpenSourceListEntry } from "@/lib/open-source-types";
import { getPublicDatabase } from "@/lib/public-database";

const contentRowSchema = z.object({ content_json: z.string().min(1) });

function parseEntry(contentJson: string): OpenSourceEntry {
  return openSourceEntrySchema.parse(JSON.parse(contentJson));
}

export async function getOpenSourceListEntries(): Promise<OpenSourceListEntry[]> {
  return getPublicDatabase()
    .prepare("SELECT content_json FROM open_source_items ORDER BY display_rank ASC, published_at DESC")
    .all()
    .map((row) => contentRowSchema.parse(row))
    .map((row) => toOpenSourceListEntry(parseEntry(row.content_json)));
}

// /api/open-source 的分页读取：策展集合小（当前 10 条），直接整表切片，
// 响应契约与其余信息流接口一致（{ hasMore, items }）。
export async function getOpenSourcePage(offset = 0, limit = 20) {
  const entries = await getOpenSourceListEntries();
  return {
    hasMore: offset + limit < entries.length,
    items: entries.slice(offset, offset + limit),
  };
}

export const getOpenSourceEntry = cache(async (slug: string): Promise<OpenSourceEntry | null> => {
  if (!/^[\w-]+$/u.test(slug)) return null;
  const row = getPublicDatabase().prepare("SELECT content_json FROM open_source_items WHERE slug = ?").get(slug);
  return row ? parseEntry(contentRowSchema.parse(row).content_json) : null;
});
