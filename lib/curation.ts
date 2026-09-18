import "server-only";

import { statSync } from "node:fs";
import { cache } from "react";
import { z } from "zod";

import { curationItemSchema } from "@/lib/curation-types";
import type { CurationItem, CurationListItem } from "@/lib/curation-types";
import { getPublicDatabase, PUBLIC_DATABASE_PATH } from "@/lib/public-database";

const curationContentRowSchema = z.object({ content_json: z.string().min(1) });
const curationNeighborRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
const localSearchRowSchema = z.object({
  content: z.string().min(1),
  id: z.string().min(1),
  published_at: z.string().datetime({ offset: true }).nullable(),
  search_text: z.string().min(1),
  section: z.string().nullable(),
  source_id: z.string().min(1),
  source_scope: z.enum(["daily", "open-source", "profile"]),
  source_url: z.string().min(1),
  title: z.string().min(1),
});
const localSearchFtsRowSchema = z.object({ id: z.string().min(1), rank: z.number() });

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
): Promise<CurationPage> {
  const where = designOnly
    ? `${CURATION_PLATFORM} = 'x' AND ${CURATION_DESIGN_INCLUDE}`
    : `${CURATION_PLATFORM} = ?`;
  const order = platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER;
  const items = selectCurationRows(
    `${where} ORDER BY ${order}`,
    designOnly ? [] : [platform],
    offset,
    limit,
  );
  return { hasMore: items.length > limit, items: items.slice(0, limit) };
}

/** 每日关注：来源拆分后只呈现 X 条目；抖音条目由 /douyin 板块承载。 */
export async function getCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("x", offset, limit);
}

/** 抖音收藏板块：只呈现公开投影中已发布的抖音来源条目。 */
export async function getDouyinCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("douyin", offset, limit);
}

/** 设计收藏：只呈现模型高置信收录的 X 条目；中置信结果留在本地队列等待复核。 */
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

export type LocalAskDocument = {
  content: string;
  id: string;
  publishedAt: string | null;
  score: number;
  scope: "daily" | "open-source" | "profile";
  section: string | null;
  sourceId: string;
  sourceUrl: string;
  title: string;
};

function occurrences(text: string, query: string) {
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(query, start);
    if (index < 0) return count;
    count += 1;
    start = index + query.length;
  }
}

/** The daily corpus is small and ships with the deployment, so an in-process scorer avoids a second remote X index. */

type DailySearchCorpusEntry = {
  content: string;
  id: string;
  lowercaseContent: string;
  lowercaseSearchText: string;
  lowercaseTitle: string;
  publishedAt: string | null;
  scope: "daily" | "open-source" | "profile";
  section: string | null;
  sourceId: string;
  sourceUrl: string;
  title: string;
};

// 语料随部署冻结（curation.sqlite 打包进产物）：按 DB 文件 mtime 做模块级缓存，
// 小写文本只预处理一次，避免每次提问都全表 SELECT + 逐行 zod parse + 三次 lowercase
//（检索的 fallback 路径下单次提问会重复调用本函数多次）。
let dailySearchCorpusCache: { entries: DailySearchCorpusEntry[]; mtimeMs: number } | undefined;

function getDailySearchCorpus(): DailySearchCorpusEntry[] {
  const mtimeMs = statSync(PUBLIC_DATABASE_PATH).mtimeMs;
  if (dailySearchCorpusCache?.mtimeMs === mtimeMs) return dailySearchCorpusCache.entries;

  const entries = getPublicDatabase()
    .prepare("SELECT id, source_scope, published_at, title, section, content, search_text, source_id, source_url FROM ask_documents")
    .all()
    .map((row) => localSearchRowSchema.parse(row))
    .map((row) => ({
      content: row.content,
      id: row.id,
      lowercaseContent: row.content.toLocaleLowerCase("en-US"),
      lowercaseSearchText: row.search_text.toLocaleLowerCase("en-US"),
      lowercaseTitle: row.title.toLocaleLowerCase("en-US"),
      publishedAt: row.published_at,
      scope: row.source_scope,
      section: row.section,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      title: row.title,
    }));
  dailySearchCorpusCache = { entries, mtimeMs };
  return entries;
}

function searchLocalAskFts(query: string, scope: LocalAskDocument["scope"], limit: number) {
  if (Array.from(query).length < 3) return [];
  try {
    return getPublicDatabase()
      .prepare(`SELECT documents.id, bm25(ask_documents_fts, 6.0, 1.0) AS rank
        FROM ask_documents_fts
        JOIN ask_documents AS documents ON documents.rowid = ask_documents_fts.rowid
        WHERE ask_documents_fts MATCH ? AND documents.source_scope = ?
        ORDER BY rank
        LIMIT ?`)
      .all(`"${query.replaceAll('"', '""')}"`, scope, limit)
      .map((row) => localSearchFtsRowSchema.parse(row));
  } catch {
    return [];
  }
}

export function searchLocalAskDocuments(
  query: string,
  scope: LocalAskDocument["scope"],
  limit = 6,
): LocalAskDocument[] {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle) return [];

  const corpus = getDailySearchCorpus().filter((entry) => entry.scope === scope);
  const byId = new Map(corpus.map((entry) => [entry.id, entry]));
  const ftsRows = searchLocalAskFts(needle, scope, limit * 4);
  if (ftsRows.length > 0) {
    return ftsRows
      .flatMap((row, index) => {
        const entry = byId.get(String(row.id));
        if (!entry) return [];
        return [{
          content: entry.content,
          id: entry.id,
          publishedAt: entry.publishedAt,
          score: 4 / (index + 1)
            + occurrences(entry.lowercaseTitle, needle) * 8
            + occurrences(entry.lowercaseSearchText, needle) * 2,
          scope: entry.scope,
          section: entry.section,
          sourceId: entry.sourceId,
          sourceUrl: entry.sourceUrl,
          title: entry.title,
        }];
      })
      .slice(0, limit);
  }

  return corpus
    .map((entry) => ({
      content: entry.content,
      id: entry.id,
      publishedAt: entry.publishedAt,
      score: occurrences(entry.lowercaseTitle, needle) * 8
        + occurrences(entry.lowercaseSearchText, needle) * 2
        + occurrences(entry.lowercaseContent, needle),
      scope: entry.scope,
      section: entry.section,
      sourceId: entry.sourceId,
      sourceUrl: entry.sourceUrl,
      title: entry.title,
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
