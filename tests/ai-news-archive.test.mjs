import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { archiveCutoff, archiveMetadata, openArchive, pruneArchivedRows, readArchivedItem, readArchivedPage, readPublicRows, saveArchive, searchArchivedItems } from "../modules/ai-news/archive.mjs";

const snapshot = { cutoff: "2026-09-28T16:00:00.000Z", capturedAt: "2026-09-28T20:17:00.000Z" };
const row = (id, publishedAt = "2026-09-24T10:00:00.000Z", title = "模型发布") => ({
  id, published_at: publishedAt, synced_at: "2026-09-28T20:00:00.000Z", selected: false,
  content: { id, category: "ai-models", publishedAt, title, summary: "中文摘要", reason: "推荐理由", sourceName: "来源", score: 80, url: `https://example.com/${id}` },
});

function fakeClient(rows, mutations = [], fail = false) {
  return { from(table) {
    let after = "";
    let deleting = false;
    let cutoff;
    const filters = {};
    const query = {
      select() { return query; }, order() { return query; }, limit() { return query; }, or(value) { cutoff = /published_at.lt.([^,]+)/.exec(value)?.[1]; return query; },
      gt(_key, value) { after = value; return query; },
      delete() { deleting = true; return query; },
      in(key, value) { filters[key] = value; return query; },
      eq(key, value) { filters[key] = value; return query; },
      lte(key, value) { filters[key] = value; return query; },
      then(resolve) {
        if (deleting) mutations.push({ table, filters });
        resolve({ data: deleting ? null : rows.filter((item) => item.id > after && (!cutoff || (item.published_at ?? item.synced_at) < cutoff)).slice(0, 1), error: fail ? { message: "offline" } : null });
      },
    };
    return query;
  } };
}

describe("AI news durable archive", () => {
  it("uses Beijing midnight and keeps history, corrections, null dates and deterministic ordering", () => {
    assert.equal(archiveCutoff(new Date("2026-09-28T15:59:59Z")), "2026-09-27T16:00:00.000Z");
    assert.equal(archiveCutoff(new Date("2026-09-28T16:00:00Z")), snapshot.cutoff);
    const db = openArchive(":memory:", false);
    try {
      saveArchive(db, [row("a"), row("b"), { ...row("c", null), synced_at: "2026-09-24T10:00:00.000Z" }], snapshot);
      saveArchive(db, [row("b", undefined, "更正后的模型")], snapshot);
      assert.equal(archiveMetadata(db).count, 3);
      assert.deepEqual(readArchivedPage(db, 10).map((item) => item.id), ["b", "a", "c"]);
      assert.deepEqual(readArchivedPage(db, 10, ["b"]).map((item) => item.id), ["a", "c"]);
      assert.equal(readArchivedItem(db, "b").title, "更正后的模型");
      assert.equal(searchArchivedItems(db, "更正", 6)[0].id, "b");
      assert.equal(searchArchivedItems(db, "更正", 6, ["b"]).length, 0);
      assert.equal(searchArchivedItems(db, "%_", 6).length, 0);
      assert.equal(readArchivedItem(db, "missing"), null);
      const before = archiveMetadata(db);
      assert.throws(() => saveArchive(db, [row("valid"), row("invalid", "2026-09-29T00:00:00Z")], snapshot));
      assert.deepEqual(archiveMetadata(db), before);
      assert.equal(readArchivedItem(db, "valid"), null);
    } finally { db.close(); }
  });

  it("reads every page even when the server caps results below the requested page size", async () => {
    assert.deepEqual((await readPublicRows(fakeClient([row("a"), row("b"), row("c")]))).map((item) => item.id), ["a", "b", "c"]);
    await assert.rejects(readPublicRows(fakeClient([], [], true)), /offline/);
  });

  it("refuses prune before deployment, preserves changed/unarchived rows, defaults to dry-run and guards concurrent updates", async () => {
    const db = openArchive(":memory:", false);
    const mutations = [];
    try {
      const deployed = saveArchive(db, [row("a"), row("b"), row("d", "2026-09-28T10:00:00.000Z")], snapshot);
      const client = fakeClient([row("a"), row("b", undefined, "新版"), row("c"), row("d", "2026-09-28T10:00:00.000Z")], mutations);
      await assert.rejects(pruneArchivedRows(client, db, null), /拒绝清理/);
      await assert.rejects(pruneArchivedRows(client, db, { ...deployed, digest: "other" }), /拒绝清理/);
      assert.equal(mutations.length, 0);
      assert.deepEqual(await pruneArchivedRows(client, db, deployed, { now: new Date("2026-09-29T00:00:00Z") }), { dryRun: true, eligible: 1 });
      assert.equal(mutations.length, 0);
      assert.deepEqual(await pruneArchivedRows(client, db, deployed, { dryRun: false, now: new Date("2026-09-29T00:00:00Z") }), { dryRun: false, eligible: 1 });
      assert.deepEqual(mutations.map((item) => item.table), ["ai_news_public_items", "ai_news_items"]);
      assert.deepEqual(mutations[0].filters, { id: ["a"], synced_at: row("a").synced_at });
    } finally { db.close(); }
  });
});
