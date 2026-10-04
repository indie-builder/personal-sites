import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import Database from "better-sqlite3";
import { mkdtemp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { toDailySearchDocuments } from "@site/public-data/ask/search-index.mjs";
import {
  compactPublicDatabase,
  initializePublicDatabase,
  insertAskDocuments,
  preserveSupplementalProjection,
} from "@site/public-data/sqlite.mjs";

function sortPublicFocusItems(items) {
  return [...items].sort(
    (left, right) =>
      (right.collectedAt ?? "").localeCompare(left.collectedAt ?? "") ||
      (left.collectedOrder ?? Number.MAX_SAFE_INTEGER) - (right.collectedOrder ?? Number.MAX_SAFE_INTEGER) ||
      (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") ||
      right.id.localeCompare(left.id),
  );
}

/** Build the Git-tracked, read-only projection. Sensitive source queues never leave this process. */
export function buildPublicCurationDatabase({ outputPath, items: unsortedItems }) {
  return Effect.scoped(
    Effect.gen(function* () {
      const items = sortPublicFocusItems(unsortedItems);
      if (items.length === 0)
        return yield* Effect.fail(new Error("没有已批准的每日关注条目，无法生成公开 SQLite 投影。"));

      const outputDirectory = path.dirname(outputPath);
      yield* io("curation.directory", () => mkdir(outputDirectory, { recursive: true }));
      const temporaryDirectory = yield* Effect.acquireRelease(
        io("curation.temp", () => mkdtemp(path.join(outputDirectory, ".curation-sqlite-"))),
        (directory) => io("curation.cleanup", () => rm(directory, { force: true, recursive: true })).pipe(Effect.orDie),
      );
      const temporaryPath = path.join(temporaryDirectory, "curation.sqlite");

      const documents = yield* Effect.scoped(
        Effect.gen(function* () {
          const database = yield* Effect.acquireRelease(
            attempt("curation.database", () => new Database(temporaryPath)),
            (database) => Effect.sync(() => database.close()),
          );
          return yield* attempt("curation.project", () => {
            initializePublicDatabase(database);
            database.pragma("journal_mode = DELETE");
            preserveSupplementalProjection(outputPath, database);

            const insertItem = database.prepare(`
      INSERT INTO curation_items (id, collected_at, collected_order, published_at, title, content_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
            database.transaction((rows) => {
              for (const item of rows) {
                insertItem.run(
                  item.id,
                  item.collectedAt,
                  item.collectedOrder,
                  item.publishedAt,
                  item.title,
                  JSON.stringify(item),
                );
              }
            })(items);

            const documents = toDailySearchDocuments(
              items.map((content) => ({ content, published_at: content.publishedAt })),
            );
            database.transaction(() => insertAskDocuments(database, documents))();
            compactPublicDatabase(database);
            return documents;
          });
        }),
      );
      yield* io("curation.publish", () => rename(temporaryPath, outputPath));
      return { documentCount: documents.length, itemCount: items.length };
    }),
  );
}
