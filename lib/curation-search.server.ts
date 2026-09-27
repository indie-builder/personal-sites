import "server-only";

import { statSync } from "node:fs";
import { z } from "zod";

import { getPublicDatabase, PUBLIC_DATABASE_PATH } from "@/lib/public-database";
import { byScoreThenRecency, occurrences } from "@/lib/search-score";

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

function toAskDocument(entry: DailySearchCorpusEntry, score: number): LocalAskDocument {
  return {
    content: entry.content,
    id: entry.id,
    publishedAt: entry.publishedAt,
    score,
    scope: entry.scope,
    section: entry.section,
    sourceId: entry.sourceId,
    sourceUrl: entry.sourceUrl,
    title: entry.title,
  };
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
        return [toAskDocument(entry, 4 / (index + 1)
            + occurrences(entry.lowercaseTitle, needle) * 8
            + occurrences(entry.lowercaseSearchText, needle) * 2)];
      })
      .slice(0, limit);
  }

  return corpus
    .map((entry) => toAskDocument(entry, occurrences(entry.lowercaseTitle, needle) * 8
        + occurrences(entry.lowercaseSearchText, needle) * 2
        + occurrences(entry.lowercaseContent, needle)))
    .filter((row) => row.score > 0)
    .sort(byScoreThenRecency)
    .slice(0, limit);
}
