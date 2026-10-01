import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import { isUsefulVectorChunk, publicAskVectorSource, splitText } from "./algorithms.mjs";
import {
  BATCH_SIZE,
  curationDatabasePath,
  databasePath,
  defaultInputs,
  INDEXER_VERSION,
  INDEX_FINGERPRINT_KEY,
  MODEL_DTYPE,
  MODEL_ID,
  repoRoot,
  SUPPORTED_EXTENSIONS,
  VECTOR_DIMENSIONS,
} from "./config.mjs";
import { embed, getEmbedder } from "./model.mjs";

function resolveInsideRepo(input) {
  const absolutePath = path.resolve(repoRoot, input);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`索引输入必须位于项目目录内：${input}`);
  }
  return absolutePath;
}

function collectFiles(inputs, { ignoreMissing = false } = {}) {
  return io("vectors.files", async () => {
    const files = [];

    async function visit(entryPath) {
      let entryStat;
      try {
        entryStat = await stat(entryPath);
      } catch (error) {
        if (ignoreMissing && error.code === "ENOENT") return;
        throw error;
      }
      if (entryStat.isFile()) {
        if (SUPPORTED_EXTENSIONS.has(path.extname(entryPath).toLowerCase())) files.push(entryPath);
        return;
      }
      if (!entryStat.isDirectory()) return;

      const entries = await readdir(entryPath, { withFileTypes: true });
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.isSymbolicLink()) continue;
        await visit(path.join(entryPath, entry.name));
      }
    }

    for (const input of inputs) await visit(resolveInsideRepo(input));
    return [...new Set(files)].sort();
  });
}

function readChunks(inputs, options) {
  return Effect.gen(function* () {
    const chunks = [];
    const files = yield* collectFiles(inputs, options);
    for (const filePath of files) {
      const source = path.relative(repoRoot, filePath);
      const content = yield* io("readChunks", () => readFile(filePath, "utf8"));
      splitText(content)
        .filter(isUsefulVectorChunk)
        .forEach((chunk, chunkIndex) => {
          chunks.push({ chunkIndex, content: chunk, source });
        });
    }
    return { chunks, fileCount: files.length };
  });
}

function readPublicProjectionChunks() {
  const database = new Database(curationDatabasePath, { fileMustExist: true, readonly: true });
  try {
    const askRows = database
      .prepare(
        `
      SELECT id, source_scope, source_id, title, content
      FROM ask_documents
      ORDER BY id
    `,
      )
      .all();
    const askChunks = askRows.flatMap((row) =>
      splitText(`${row.title}\n\n${row.content}`)
        .filter(isUsefulVectorChunk)
        .map((content, chunkIndex) => ({
          chunkIndex,
          content,
          source: publicAskVectorSource(row),
        })),
    );
    return { chunks: askChunks, itemCount: askRows.length };
  } finally {
    database.close();
  }
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readCachedVectors() {
  const vectors = new Map();
  if (!existsSync(databasePath)) return vectors;

  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    sqliteVec.load(database);
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value FROM metadata")
        .all()
        .map((row) => [row.key, row.value]),
    );
    if (metadata.model !== MODEL_ID || Number(metadata.dimensions) !== VECTOR_DIMENSIONS) return vectors;

    for (const row of database
      .prepare(
        `
      SELECT d.content, v.embedding
      FROM documents d
      JOIN document_vectors v ON v.rowid = d.id
    `,
      )
      .iterate()) {
      vectors.set(contentHash(row.content), Buffer.from(row.embedding));
    }
    return vectors;
  } finally {
    database.close();
  }
}

function initializeDatabase(database) {
  sqliteVec.load(database);
  database.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      UNIQUE(source, chunk_index)
    ) STRICT;

    CREATE VIRTUAL TABLE documents_fts USING fts5(
      content,
      content='documents',
      content_rowid='id',
      tokenize='trigram'
    );

    CREATE VIRTUAL TABLE document_vectors USING vec0(
      embedding float[${VECTOR_DIMENSIONS}]
    );
  `);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("model", MODEL_ID);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("dtype", MODEL_DTYPE);
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run("dimensions", String(VECTOR_DIMENSIONS));
  return database;
}

/** 默认索引的输入指纹：源文件清单 + mtime/size + 公开投影文件 + 索引参数。 */
function computeDefaultIndexFingerprint() {
  return Effect.gen(function* () {
    const files = yield* collectFiles(defaultInputs, { ignoreMissing: true });
    const parts = [`indexer:${INDEXER_VERSION}`, MODEL_DTYPE, MODEL_ID, String(VECTOR_DIMENSIONS)];
    for (const filePath of files) {
      const fileStat = yield* io("computeDefaultIndexFingerprint", () => stat(filePath));
      parts.push(`${path.relative(repoRoot, filePath)}:${fileStat.mtimeMs}:${fileStat.size}`);
    }
    if (existsSync(curationDatabasePath)) {
      const databaseStat = yield* io("computeDefaultIndexFingerprint", () => stat(curationDatabasePath));
      parts.push(`data/curation.sqlite:${databaseStat.mtimeMs}:${databaseStat.size}`);
    }
    return contentHash(parts.join("\n"));
  });
}

function readStoredFingerprint() {
  if (!existsSync(databasePath)) return null;
  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    return database.prepare("SELECT value FROM metadata WHERE key = ?").get(INDEX_FINGERPRINT_KEY)?.value ?? null;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export function buildIndex(inputs, { fingerprint = null, includeCuration = false } = {}) {
  return Effect.scoped(
    Effect.gen(function* () {
      const { chunks: fileChunks, fileCount } = yield* readChunks(inputs, { ignoreMissing: includeCuration });
      const publicProjection = includeCuration
        ? yield* attempt("vectors.public", readPublicProjectionChunks)
        : { chunks: [], itemCount: 0 };
      const chunks = [...fileChunks, ...publicProjection.chunks];
      if (chunks.length === 0) return yield* Effect.fail(new Error("没有找到可索引的 Markdown 或文本文件。"));

      yield* io("vectors.directory", () => mkdir(path.dirname(databasePath), { recursive: true }));
      const temporaryPath = yield* Effect.acquireRelease(
        Effect.sync(() => `${databasePath}.${randomUUID()}.tmp`),
        (temporaryPath) => io("vectors.cleanup", () => rm(temporaryPath, { force: true })).pipe(Effect.orDie),
      );

      console.log(
        `准备索引 ${fileCount} 个文件、${includeCuration ? `${publicProjection.itemCount} 条公开记录、` : ""}${chunks.length} 个分块；首次运行会下载本地模型。`,
      );
      const cachedVectors = yield* attempt("vectors.cache", readCachedVectors);
      let embedder;
      let generatedCount = 0;
      let reusedCount = 0;
      yield* Effect.scoped(
        Effect.gen(function* () {
          const database = yield* Effect.acquireRelease(
            attempt("vectors.database", () => new Database(temporaryPath)),
            (database) => Effect.sync(() => database.close()),
          );
          yield* attempt("vectors.initialize", () => initializeDatabase(database));
          if (fingerprint) {
            database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run(INDEX_FINGERPRINT_KEY, fingerprint);
          }
          const insertDocument = database.prepare(
            "INSERT INTO documents(id, source, chunk_index, content) VALUES (?, ?, ?, ?)",
          );
          const insertKeyword = database.prepare("INSERT INTO documents_fts(rowid, content) VALUES (?, ?)");
          const insertVector = database.prepare("INSERT INTO document_vectors(rowid, embedding) VALUES (?, ?)");
          const insertBatch = database.transaction((batch, vectors, offset) => {
            batch.forEach((chunk, index) => {
              const id = offset + index + 1;
              insertDocument.run(id, chunk.source, chunk.chunkIndex, chunk.content);
              insertKeyword.run(id, chunk.content);
              insertVector.run(BigInt(id), vectors[index]);
            });
          });

          for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
            const batch = chunks.slice(offset, offset + BATCH_SIZE);
            const vectors = batch.map((chunk) => cachedVectors.get(contentHash(chunk.content)) ?? null);
            const missingIndexes = vectors.flatMap((vector, index) => (vector ? [] : [index]));
            if (missingIndexes.length > 0) {
              embedder ??= yield* getEmbedder();
              const generated = yield* embed(
                embedder,
                missingIndexes.map((index) => batch[index].content),
              );
              missingIndexes.forEach((batchIndex, generatedIndex) => {
                vectors[batchIndex] = new Float32Array(generated[generatedIndex]);
              });
            }
            generatedCount += missingIndexes.length;
            reusedCount += batch.length - missingIndexes.length;
            yield* attempt("vectors.batch", () => insertBatch(batch, vectors, offset));
            process.stdout.write(`\r已处理 ${Math.min(offset + batch.length, chunks.length)}/${chunks.length} 个向量`);
          }
          process.stdout.write("\n");
        }),
      );
      yield* io("vectors.publish", () => rename(temporaryPath, databasePath));
      console.log(
        `本地索引已写入 ${path.relative(repoRoot, databasePath)}（复用 ${reusedCount}，新生成 ${generatedCount}）。`,
      );
    }),
  );
}

export function rebuildDefaultIndex() {
  return Effect.gen(function* () {
    // 指纹短路：管线尾部（curation:publish、GitHub daily）都会调用这里，
    // 输入无变化时跳过全量重扫——读源文件、全库 SHA-256 比对、重建临时库都不再发生。
    const fingerprint = yield* computeDefaultIndexFingerprint();
    if (fingerprint === readStoredFingerprint()) {
      console.log("索引输入无变化，跳过本地向量索引重建。");
      return;
    }
    return yield* buildIndex(defaultInputs, { fingerprint, includeCuration: true });
  });
}
