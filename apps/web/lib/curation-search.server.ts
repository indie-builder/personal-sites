import { DateTimeString } from "@site/effect/schema";
import "server-only";

import { statSync } from "node:fs";
import { Schema } from "effect";

import { getPublicDatabase, PUBLIC_DATABASE_PATH } from "@/lib/public-database";
import type { AskDocumentScope, AskSource } from "@/lib/ask-types";

/** 统计已归一为小写的文本中，needle 不重叠的出现次数。 */
function occurrences(text: string, needle: string) {
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(needle, start);
    if (index < 0) return count;
    count += 1;
    start = index + needle.length;
  }
}

const localSearchRowSchema = Schema.Struct({
  content: Schema.String.check(Schema.isMinLength(1)),
  id: Schema.String.check(Schema.isMinLength(1)),
  published_at: Schema.NullOr(DateTimeString),
  search_text: Schema.String.check(Schema.isMinLength(1)),
  section: Schema.NullOr(Schema.String),
  source_id: Schema.String.check(Schema.isMinLength(1)),
  source_scope: Schema.Literals(["daily", "open-source", "profile"]),
  source_url: Schema.String.check(Schema.isMinLength(1)),
  title: Schema.String.check(Schema.isMinLength(1)),
});
const localSearchFtsRowSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1)),
  rank: Schema.Number.check(Schema.isFinite()),
});

type LocalAskDocument = Omit<AskSource, "scope"> & {
  score: number;
  scope: Exclude<AskDocumentScope, "ai-news">;
};

/** The daily corpus is small and ships with the deployment, so an in-process scorer avoids a second remote X index. */

type DailySearchCorpusEntry = Omit<LocalAskDocument, "score"> & {
  lowercaseContent: string;
  lowercaseSearchText: string;
  lowercaseTitle: string;
};

// 语料随部署冻结（curation.sqlite 打包进产物）：按 DB 文件 mtime 做模块级缓存，
// 小写文本只预处理一次，避免每次提问都全表 SELECT + 逐行 Schema decode + 三次 lowercase
//（检索的 fallback 路径下单次提问会重复调用本函数多次）。
let dailySearchCorpusCache: { entries: DailySearchCorpusEntry[]; mtimeMs: number } | undefined;

function getDailySearchCorpus(): DailySearchCorpusEntry[] {
  const mtimeMs = statSync(PUBLIC_DATABASE_PATH).mtimeMs;
  if (dailySearchCorpusCache?.mtimeMs === mtimeMs) return dailySearchCorpusCache.entries;

  const entries = getPublicDatabase()
    .prepare(
      "SELECT id, source_scope, published_at, title, section, content, search_text, source_id, source_url FROM ask_documents",
    )
    .all()
    .map((row) => Schema.decodeUnknownSync(localSearchRowSchema)(row))
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
      .prepare(
        `SELECT documents.id, bm25(ask_documents_fts, 6.0, 1.0) AS rank
        FROM ask_documents_fts
        JOIN ask_documents AS documents ON documents.rowid = ask_documents_fts.rowid
        WHERE ask_documents_fts MATCH ? AND documents.source_scope = ?
        ORDER BY rank
        LIMIT ?`,
      )
      .all(`"${query.replaceAll('"', '""')}"`, scope, limit)
      .map((row) => Schema.decodeUnknownSync(localSearchFtsRowSchema)(row));
  } catch {
    return [];
  }
}

function toAskDocument(entry: DailySearchCorpusEntry, score: number): LocalAskDocument {
  const { lowercaseContent: _content, lowercaseSearchText: _searchText, lowercaseTitle: _title, ...document } = entry;
  return { ...document, score };
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
        return [
          toAskDocument(
            entry,
            4 / (index + 1) +
              occurrences(entry.lowercaseTitle, needle) * 8 +
              occurrences(entry.lowercaseSearchText, needle) * 2,
          ),
        ];
      })
      .slice(0, limit);
  }

  return corpus
    .map((entry) =>
      toAskDocument(
        entry,
        occurrences(entry.lowercaseTitle, needle) * 8 +
          occurrences(entry.lowercaseSearchText, needle) * 2 +
          occurrences(entry.lowercaseContent, needle),
      ),
    )
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
