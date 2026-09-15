import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";

import { initializePublicDatabase, insertAskDocuments } from "../modules/public-data/sqlite.mjs";
import { readPublicDataHealth } from "../modules/data-health/sqlite.mjs";
import { toProfileSearchDocument } from "../modules/ask/search-index.mjs";

test("new public databases reject retired project sources", () => {
  const database = initializePublicDatabase(new Database(":memory:"));
  try {
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name='project_snapshots'").get(), undefined);
    assert.throws(() => insertAskDocuments(database, [{
      ...toProfileSearchDocument(), id: "retired", source_scope: "works", source_url: "/works/retired",
    }]), /CHECK constraint/u);
    assert.equal(readPublicDataHealth(database).askDocuments, 1);
  } finally {
    database.close();
  }
});

test("published database contains only active sources and aligned FTS", () => {
  const database = new Database("data/curation.sqlite", { readonly: true });
  try {
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name='project_snapshots'").get(), undefined);
    assert.equal(database.prepare("SELECT count(*) AS count FROM ask_documents WHERE source_scope='works' OR source_url LIKE '/works/%'").get().count, 0);
    const health = readPublicDataHealth(database);
    assert.equal(health.quickCheck, "ok");
    assert.equal(health.askDocuments, health.askFts);
    assert.equal(health.askMissingFts, 0);
    assert.equal(health.askOrphanFts, 0);
    assert.ok(health.curation.x.count > 0 && health.curation.douyin.count > 0 && health.openSource.count > 0);
  } finally {
    database.close();
  }
});
