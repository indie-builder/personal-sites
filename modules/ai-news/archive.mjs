import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { aiNewsItemContentSchema } from "../../lib/ai-news-types.ts";

export const ARCHIVE_PATH = "data/ai-news.sqlite";
const DAY_MS = 86400000;

export function archiveCutoff(now = new Date()) {
  return new Date(Math.floor((now.getTime() + 8 * 3600000) / DAY_MS) * DAY_MS - 8 * 3600000).toISOString();
}

export function openArchive(filename = ARCHIVE_PATH, readonly = true) {
  const db = new Database(filename, { readonly, fileMustExist: readonly });
  db.function("news_lower", { deterministic: true }, (value) => String(value).toLowerCase());
  if (!readonly) db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY, published_at TEXT, synced_at TEXT NOT NULL,
      content TEXT NOT NULL, selected INTEGER NOT NULL CHECK(selected IN (0,1))
    );
    CREATE INDEX IF NOT EXISTS items_date ON items(published_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS archive_meta (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
  `);
  return db;
}

export function archiveMetadata(db) {
  const row = db.prepare("SELECT value FROM archive_meta WHERE id = 1").get();
  return row ? JSON.parse(row.value) : null;
}

export function readArchivedItem(db, id) {
  const row = db.prepare("SELECT content, selected FROM items WHERE id = ?").get(id);
  return row ? { ...JSON.parse(row.content), selected: Boolean(row.selected) } : null;
}

export function readArchivedPage(db, limit, excludedIds = [], offset = 0) {
  return db.prepare(`SELECT content, selected FROM items
    WHERE id NOT IN (SELECT value FROM json_each(?))
    ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(JSON.stringify(excludedIds), limit, offset)
    .map((row) => ({ ...JSON.parse(row.content), selected: Boolean(row.selected) }));
}

export function compareNews(left, right) {
  const dateOrder = (right.publishedAt ? Date.parse(right.publishedAt) : -Infinity)
    - (left.publishedAt ? Date.parse(left.publishedAt) : -Infinity);
  return dateOrder || (right.id > left.id ? 1 : right.id < left.id ? -1 : 0);
}

export function newsSearchScore(item, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const occurrences = (text) => text.toLowerCase().split(needle).length - 1;
  return occurrences(item.title) * 8 + occurrences(item.summary) * 2
    + occurrences([item.reason, item.category, item.sourceName].join("\n"));
}

export function searchArchivedItems(db, query, limit, excludedIds = []) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  // ponytail: literal scan supports short Chinese queries; add a CJK index if history makes this slow.
  return db.prepare(`SELECT content, selected FROM items
    WHERE id NOT IN (SELECT value FROM json_each(?))
      AND instr(news_lower(json_extract(content, '$.title') || char(10) ||
        json_extract(content, '$.summary') || char(10) || json_extract(content, '$.reason') || char(10) ||
        json_extract(content, '$.category') || char(10) || json_extract(content, '$.sourceName')), ?) > 0`)
    .all(JSON.stringify(excludedIds), needle)
    .map((row) => {
      const item = JSON.parse(row.content);
      return { ...item, selected: Boolean(row.selected), score: newsSearchScore(item, needle) };
    })
    .sort((a, b) => b.score - a.score || compareNews(a, b)).slice(0, limit);
}

/** Stable keyset pagination; never infer completeness from a server's capped page length. */
export async function readPublicRows(client, { cutoff, select = "id,content,selected,published_at,synced_at", changedSince } = {}) {
  const rows = [];
  let lastId;
  while (true) {
    let request = client.from("ai_news_public_items").select(select).order("id").limit(500);
    if (cutoff) request = request.or(`published_at.lt.${cutoff},and(published_at.is.null,synced_at.lt.${cutoff})`);
    if (changedSince) request = request.or(`published_at.gte.${changedSince.cutoff},synced_at.gte.${changedSince.capturedAt}`);
    if (lastId) request = request.gt("id", lastId);
    const { data, error } = await request;
    if (error) throw new Error(`读取每日动态公开投影失败：${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
    lastId = data.at(-1).id;
  }
}

/** Persist only validated public fields, atomically, retaining all previously archived history. */
export function saveArchive(db, rows, { cutoff, capturedAt }) {
  const validated = rows.map((row) => {
    const content = aiNewsItemContentSchema.parse(row.content);
    if (content.id !== row.id || typeof row.selected !== "boolean" || !Number.isFinite(Date.parse(row.synced_at))
      || (content.publishedAt !== null && !Number.isFinite(Date.parse(content.publishedAt)))) {
      throw new Error("每日动态归档行无效。");
    }
    const publishedAt = content.publishedAt ? new Date(content.publishedAt).toISOString() : null;
    if ((publishedAt ?? row.synced_at) >= cutoff) throw new Error("拒绝把未到归档时间的数据写入历史。");
    return { id: content.id, content: JSON.stringify({ ...content, publishedAt }), publishedAt,
      syncedAt: new Date(row.synced_at).toISOString(), selected: Number(row.selected) };
  });
  db.transaction(() => {
    const upsert = db.prepare(`INSERT INTO items VALUES (@id, @publishedAt, @syncedAt, @content, @selected)
      ON CONFLICT(id) DO UPDATE SET published_at=excluded.published_at, synced_at=excluded.synced_at,
      content=excluded.content, selected=excluded.selected`);
    for (const row of validated) upsert.run(row);
    const digest = createHash("sha256");
    for (const row of db.prepare("SELECT * FROM items ORDER BY id").iterate()) digest.update(JSON.stringify(row));
    const metadata = { cutoff, capturedAt, count: db.prepare("SELECT count(*) AS count FROM items").get().count,
      digest: digest.digest("hex") };
    db.prepare("INSERT OR REPLACE INTO archive_meta VALUES (1, ?)").run(JSON.stringify(metadata));
  })();
  if (db.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("SQLite 完整性检查失败。");
  return archiveMetadata(db);
}

/** Only remove unchanged rows proven present in the production deployment's archive. */
export async function pruneArchivedRows(client, db, deployed, { now = new Date(), dryRun = true } = {}) {
  const metadata = archiveMetadata(db);
  if (!metadata || deployed?.digest !== metadata.digest || deployed?.cutoff !== metadata.cutoff) {
    throw new Error("线上归档与本地不一致，拒绝清理 Supabase。");
  }
  const cutoff = new Date(Math.min(Date.parse(metadata.cutoff), now.getTime() - 3 * DAY_MS)).toISOString();
  const rows = await readPublicRows(client, { cutoff });
  const byVersion = new Map();
  for (const row of rows) {
    const archived = readArchivedItem(db, row.id);
    const content = aiNewsItemContentSchema.parse(row.content);
    if (content.publishedAt) content.publishedAt = new Date(content.publishedAt).toISOString();
    if (!archived || JSON.stringify(archived) !== JSON.stringify({ ...content, selected: row.selected })) continue;
    const ids = byVersion.get(row.synced_at) ?? [];
    ids.push(row.id);
    byVersion.set(row.synced_at, ids);
  }
  const eligible = [...byVersion.values()].reduce((sum, ids) => sum + ids.length, 0);
  if (dryRun) return { dryRun, eligible };
  for (const [syncedAt, ids] of byVersion) {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      // synced_at is a compare-and-delete guard against a concurrent sync or backfill.
      const { error } = await client.from("ai_news_public_items").delete().in("id", batch).eq("synced_at", syncedAt);
      if (error) throw new Error(`清理已归档公开投影失败：${error.message}`);
      const { error: rawError } = await client.from("ai_news_items").delete().in("id", batch).lte("synced_at", syncedAt);
      if (rawError) throw new Error(`清理已归档原始记录失败：${rawError.message}`);
    }
  }
  return { dryRun, eligible };
}
