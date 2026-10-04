import { Effect } from "effect";
import { attempt } from "@site/effect";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toOpenSourceSearchDocuments } from "@site/public-data/ask/search-index.mjs";
import { compactPublicDatabase, initializePublicDatabase, insertAskDocuments, PUBLIC_DATABASE_PATH } from "@site/public-data/sqlite.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function toPublicOpenSourceItem(record, analysis, entry, displayRank, now) {
  return {
    content: {
      category: entry.category,
      dimensions: entry.dimensions,
      evidence: entry.evidence,
      parsedMarkdown: analysis.contentMarkdown,
      personalNote: entry.personalNote,
      repository: entry.repository,
      repositoryDefaultBranch: record.repository.defaultBranch,
      repositoryUrl: record.repository.repositoryUrl,
      readingSource: record.readingMarkdown ? "official-zh-readme" : "model-translation",
      readingSourcePath: record.readingSourcePath,
      slug: entry.slug,
      sourceMarkdown: record.sourceMarkdown,
      sourceSummary: analysis.oneLineSummary ?? entry.sourceSummary,
      status: entry.status,
      type: entry.type,
    },
    display_rank: displayRank,
    published_at: now,
    repo_node_id: record.repository.nodeId,
    slug: entry.slug,
  };
}

/** Publish the selected public projection locally; raw sources and analyses already live in data/sensitive. */
export function publishStarredRecords({
  analyses = [],
  databasePath = path.join(repoRoot, PUBLIC_DATABASE_PATH),
  now = new Date().toISOString(),
  records,
  seedEntries = [],
}) {
  return Effect.scoped(
    Effect.gen(function* () {
      const analysisByNodeId = new Map(analyses.map((analysis) => [analysis.repoNodeId, analysis]));
      const seedByRepository = new Map(seedEntries.map((entry, index) => [entry.repository, { entry, index }]));
      const publicRows = records.flatMap((record) => {
        const selected = seedByRepository.get(record.repository.fullName);
        const analysis = analysisByNodeId.get(record.repository.nodeId);
        return selected && analysis
          ? [toPublicOpenSourceItem(record, analysis, selected.entry, selected.index, now)]
          : [];
      });
      const documents = toOpenSourceSearchDocuments(publicRows);
      const database = yield* Effect.acquireRelease(
        attempt("github.database", () => new Database(databasePath)),
        (database) => Effect.sync(() => database.close()),
      );
      return yield* attempt("github.publish", () => {
        initializePublicDatabase(database);
        const deleteItem = database.prepare("DELETE FROM open_source_items WHERE repo_node_id = ?");
        const deleteDocuments = database.prepare(
          "DELETE FROM ask_documents WHERE source_scope = 'open-source' AND source_id = ?",
        );
        const insertItem = database.prepare(`
      INSERT INTO open_source_items (repo_node_id, slug, display_rank, published_at, content_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(repo_node_id) DO UPDATE SET
        slug = excluded.slug,
        display_rank = excluded.display_rank,
        published_at = excluded.published_at,
        content_json = excluded.content_json
    `);
        database.transaction(() => {
          for (const record of records) {
            deleteItem.run(record.repository.nodeId);
            deleteDocuments.run(record.repository.nodeId);
          }
          for (const row of publicRows) {
            insertItem.run(row.repo_node_id, row.slug, row.display_rank, row.published_at, JSON.stringify(row.content));
          }
          // The shared writer upserts; preserve this publisher's rejection of duplicate chunks.
          if (new Set(documents.map((document) => document.id)).size !== documents.length) {
            throw new Error("重复的公开问答文档 ID，无法发布 GitHub 投影。");
          }
          insertAskDocuments(database, documents);
        })();
        compactPublicDatabase(database);

        return {
          indexedCount: documents.length,
          privateAnalysisCount: analyses.length,
          privateSourceCount: records.length,
          publicCount: publicRows.length,
        };
      });
    }),
  );
}
