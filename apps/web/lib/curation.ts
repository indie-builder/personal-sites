import "server-only";

import { cache } from "react";
import { z } from "zod";

import { curationItemSchema } from "@/lib/curation-types";
import type { CurationItem, CurationListItem } from "@/lib/curation-types";
import { getPublicDatabase } from "@/lib/public-database";

const curationContentRowSchema = z.object({ content_json: z.string().min(1) });
const curationNeighborRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
const ATTACHMENT_LABELS = {
  animated_gif: "GIF",
  photo: "图片",
  video: "视频",
} as const;
const CURATION_ORDER = "collected_at DESC NULLS LAST, collected_order ASC NULLS LAST, published_at DESC NULLS LAST, id DESC";
const DOUYIN_CURATION_ORDER = "collected_order ASC NULLS LAST, collected_at DESC NULLS LAST, published_at DESC NULLS LAST, id DESC";
const CURATION_PLATFORM = "json_extract(content_json, '$.source.platform')";
const CURATION_DESIGN_INCLUDE = "json_extract(content_json, '$.design.status') = 'include'";

function parseCurationItem(contentJson: string) {
  return curationItemSchema.parse(JSON.parse(contentJson));
}

/** 把投影行折成列表条目：media/quoteContext 归并为附件登记词，原文与标签随行。 */
function toCurationListItem(item: CurationItem): CurationListItem {
  const mediaKinds = [...new Set(item.media.map((media) => media.type))];
  const attachments: string[] = mediaKinds.map((kind) => ATTACHMENT_LABELS[kind]);
  if (item.quoteContext) attachments.push("引用");
  return {
    attachments,
    author: item.author,
    collectedAt: item.collectedAt,
    design: item.design,
    id: item.id,
    media: item.media,
    publishedAt: item.publishedAt,
    source: item.source,
    summary: item.summary,
    tags: item.tags,
    text: item.text,
    title: item.title,
  };
}

export type CurationPage = {
  hasMore: boolean;
  items: CurationListItem[];
};

type CurationPlatform = "douyin" | "x";

function selectCurationRows(where: string, parameters: unknown[], offset: number, limit: number) {
  return getPublicDatabase()
    .prepare(`SELECT content_json FROM curation_items WHERE ${where} LIMIT ? OFFSET ?`)
    .all(...parameters, limit + 1, offset)
    .map((row) => curationContentRowSchema.parse(row))
    .map((row) => toCurationListItem(parseCurationItem(row.content_json)));
}

async function getCurationPageByPlatform(
  platform: CurationPlatform,
  offset: number,
  limit: number,
  designOnly = false,
  tag: string | null = null,
): Promise<CurationPage> {
  const where = designOnly
    ? `${CURATION_PLATFORM} = 'x' AND ${CURATION_DESIGN_INCLUDE}`
    : `${CURATION_PLATFORM} = ?`;
  const order = platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER;
  const items = selectCurationRows(
    `${where}${tag ? " AND EXISTS (SELECT 1 FROM json_each(content_json, '$.tags') WHERE value = ?)" : ""} ORDER BY ${order}`,
    [...(designOnly ? [] : [platform]), ...(tag ? [tag] : [])],
    offset,
    limit,
  );
  return { hasMore: items.length > limit, items: items.slice(0, limit) };
}

/** 每日关注：来源拆分后只呈现 X 条目；抖音条目由 /douyin 板块承载。 */
export async function getCurationPage(offset = 0, limit = 20, tag: string | null = null): Promise<CurationPage> {
  return getCurationPageByPlatform("x", offset, limit, false, tag);
}

/** 全库主题计数及首条 ID，不受已加载分页限制；首条用于校验返回列表的会话快照。 */
export function getCurationTags() {
  const rows = getPublicDatabase().prepare(`SELECT id, json_extract(content_json, '$.tags') AS tags
    FROM curation_items WHERE ${CURATION_PLATFORM} = 'x' ORDER BY ${CURATION_ORDER}`).all();
  const tags = new Map<string, { tag: string; count: number; headId: string }>();
  const rowSchema = z.object({ id: z.string(), tags: z.string() });
  for (const row of rows) {
    const parsed = rowSchema.parse(row);
    for (const tag of new Set(z.array(z.string()).parse(JSON.parse(parsed.tags)))) {
      const entry = tags.get(tag) ?? { tag, count: 0, headId: parsed.id };
      entry.count += 1;
      tags.set(tag, entry);
    }
  }
  const priority = (tag: string) => tag === "提示词" ? 2 : tag === "技能" ? 1 : 0;
  return [...tags.values()].sort((a, b) => priority(b.tag) - priority(a.tag) || b.count - a.count);
}

/** 抖音收藏板块：只呈现公开投影中已发布的抖音来源条目。 */
export async function getDouyinCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("douyin", offset, limit);
}

/** 设计收藏：呈现模型判断为设计相关的 X 条目。 */
export async function getDesignCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("x", offset, limit, true);
}

export type CurationNeighbors = {
  newer: { id: string; title: string } | null;
  older: { id: string; title: string } | null;
};

const curationPlatformRowSchema = z.object({ platform: z.enum(["douyin", "x"]) });

// 剪报簿总量有限（逐条人工策展的点赞），一次取全量 id+title 即可按列表同一排序定位相邻条目。
// 来源拆分后相邻导航不跨来源：抖音条目只在抖音条目间翻页，X 条目只在 X 条目间翻页。
export async function getCurationNeighbors(id: string, designOnly = false): Promise<CurationNeighbors> {
  const platformRow = getPublicDatabase()
    .prepare(`SELECT ${CURATION_PLATFORM} AS platform FROM curation_items WHERE id = ?`)
    .get(id);
  if (!platformRow) return { newer: null, older: null };
  const { platform } = curationPlatformRowSchema.parse(platformRow);
  const order = platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER;
  const rows = getPublicDatabase()
    .prepare(`SELECT id, title FROM curation_items
      WHERE ${CURATION_PLATFORM} = ?
        ${designOnly ? `AND ${CURATION_DESIGN_INCLUDE}` : ""}
      ORDER BY ${order}`)
    .all(platform)
    .map((row) => curationNeighborRowSchema.parse(row));
  const index = rows.findIndex((row) => row.id === id);
  return {
    newer: index > 0 ? (rows[index - 1] ?? null) : null,
    older: index >= 0 ? (rows[index + 1] ?? null) : null,
  };
}

export const findCurationItem = cache(async (id: string): Promise<CurationItem | null> => {
  const row = getPublicDatabase()
    .prepare("SELECT content_json FROM curation_items WHERE id = ?")
    .get(id);
  if (!row) return null;
  return parseCurationItem(curationContentRowSchema.parse(row).content_json);
});
