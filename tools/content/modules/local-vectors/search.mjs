import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

import { compactText, mergeRankings } from "./algorithms.mjs";
import { databasePath, MODEL_ID, QUERY_PREFIX, VECTOR_DIMENSIONS } from "./config.mjs";
import { embed, getEmbedder } from "./model.mjs";

function quoteFtsQuery(query) {
  return `"${query.replaceAll('"', '""')}"`;
}

export async function search(query) {
  if (!compactText(query)) throw new Error("搜索词不能为空。");

  const embedder = await getEmbedder();
  const [queryVector] = await embed(embedder, [`${QUERY_PREFIX}${compactText(query)}`]);
  const database = new Database(databasePath, { fileMustExist: true, readonly: true });
  sqliteVec.load(database);

  try {
    const metadata = Object.fromEntries(
      database.prepare("SELECT key, value FROM metadata").all().map((row) => [row.key, row.value]),
    );
    if (metadata.model !== MODEL_ID || Number(metadata.dimensions) !== VECTOR_DIMENSIONS) {
      throw new Error("索引模型配置已变化，请先重新运行 pnpm vectors:index。");
    }

    const candidateCount = 32;
    const vectorRows = database.prepare(`
      SELECT rowid AS id, distance
      FROM document_vectors
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(new Float32Array(queryVector), candidateCount);

    const keywordRows = Array.from(compactText(query)).length < 3
      ? []
      : database.prepare(`
          SELECT rowid AS id, bm25(documents_fts) AS rank
          FROM documents_fts
          WHERE documents_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(quoteFtsQuery(compactText(query)), candidateCount);

    const ranking = mergeRankings(vectorRows, keywordRows);
    if (ranking.length === 0) {
      console.log("没有找到相关内容。");
      return;
    }

    const placeholders = ranking.map(() => "?").join(",");
    const documents = database.prepare(
      `SELECT id, source, chunk_index, content FROM documents WHERE id IN (${placeholders})`,
    ).all(...ranking.map((row) => row.id));
    const byId = new Map(documents.map((document) => [document.id, document]));

    ranking.forEach((row, index) => {
      const document = byId.get(row.id);
      const preview = document.content.replace(/\s+/g, " ").slice(0, 220);
      console.log(`\n${index + 1}. ${document.source}#${document.chunk_index + 1} (${row.score.toFixed(4)})`);
      console.log(preview);
    });
  } finally {
    database.close();
  }
}
