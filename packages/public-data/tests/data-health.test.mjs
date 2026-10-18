import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { readPublicDataHealth, recordXSyncState } from "../src/data-health/sqlite.mjs";
import { buildDataHealth } from "../src/data-health/status.mjs";
import { initializePublicDatabase, preserveSupplementalProjection } from "../src/sqlite.mjs";

const now = new Date("2026-08-29T12:00:00.000Z");
const base = {
  aiNews: { ageMinutes: 5, healthy: true, lastSucceededAt: "2026-08-29T11:55:00.000Z", running: false },
  now,
  publicData: {
    askDocuments: 10,
    askSearchableDocuments: 10,
    askFts: 10,
    askMissingFts: 0,
    askOrphanFts: 0,
    askMissingPostings: 0,
    askExtraPostings: 0,
    curation: {
      douyin: { count: 5, latestAt: "2026-08-29T10:00:00.000Z" },
      x: { count: 5, latestAt: "2026-08-29T11:00:00.000Z", sync: {
        status: "succeeded", lastStartedAt: "2026-08-29T10:00:00.000Z", lastFinishedAt: "2026-08-29T11:00:00.000Z", lastSucceededAt: "2026-08-29T11:00:00.000Z",
      } },
    },
    openSource: { count: 3, latestAt: "2026-08-28T12:00:00.000Z" },
    quickCheck: "ok",
  },
};

function fixture(path = ":memory:") {
  const database = initializePublicDatabase(new Database(path));
  recordXSyncState(database, "running", "2026-08-29T09:00:00.000Z", "fixture");
  recordXSyncState(database, "succeeded", "2026-08-29T10:00:00.000Z", "fixture");
  database.exec(`
    DELETE FROM ask_documents;
    DROP TRIGGER ask_documents_fts_insert;
    DROP TRIGGER ask_documents_fts_delete;
    DROP TRIGGER ask_documents_fts_update;
    INSERT INTO curation_items(id, title, content_json, collected_at) VALUES
      ('x', 'X', '{"source":{"platform":"x"}}', '2026-08-29T10:00:00.000Z'),
      ('douyin', 'Douyin', '{"source":{"platform":"douyin"}}', '2026-08-29T09:00:00.000Z');
    INSERT INTO open_source_items VALUES ('repo', 'example/repo', 0, '2026-08-28T12:00:00.000Z', '{}');
    INSERT INTO ask_documents(rowid, id, source_scope, source_id, title, source_url, content, search_text)
      VALUES (1, 'one', 'daily', 'one', 'Alpha', '/one', 'alpha beta', 'alpha beta');
  `);
  return database;
}

const indexDocuments = `INSERT INTO ask_documents_fts(rowid, title, search_text)
  SELECT rowid, title, search_text FROM ask_documents;`;
const tokenlessDocuments = `INSERT INTO ask_documents(rowid, id, source_scope, source_id, title, source_url, content, search_text)
  VALUES (2, 'empty', 'daily', 'empty', '', '/empty', '', ''),
    (3, 'punctuation', 'daily', 'punctuation', '...', '/punctuation', '', ' - ! ');`;
const temporaryObjects = (database) => database.prepare("SELECT name FROM sqlite_temp_master ORDER BY name").all();
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const askEvidence = (evidence) => ({
  documents: evidence.askDocuments,
  searchable: evidence.askSearchableDocuments,
  indexed: evidence.askFts,
  missing: evidence.askMissingFts,
  orphan: evidence.askOrphanFts,
  missingPostings: evidence.askMissingPostings,
  extraPostings: evidence.askExtraPostings,
});
const aligned = { documents: 1, searchable: 1, indexed: 1, missing: 0, orphan: 0, missingPostings: 0, extraPostings: 0 };

const cases = [
  { name: "healthy", setup: indexDocuments, expected: aligned, healthy: true },
  { name: "missing", setup: "", expected: { ...aligned, indexed: 0, missing: 1, missingPostings: 3 }, healthy: false },
  { name: "orphan", setup: `${indexDocuments} INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (99, 'Ghost', 'phantom');`,
    expected: { ...aligned, indexed: 2, orphan: 1, extraPostings: 2 }, healthy: false },
  { name: "swapped rowids with equal counts", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (99, 'Alpha', 'alpha beta');",
    expected: { ...aligned, missing: 1, orphan: 1, missingPostings: 3, extraPostings: 3 }, healthy: false },
  { name: "obsolete tokens with correct rowids", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (1, 'Old', 'obsolete');",
    expected: { ...aligned, missingPostings: 3, extraPostings: 2 }, healthy: false },
  { name: "partial postings", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (1, 'Alpha', 'alpha');",
    expected: { ...aligned, missingPostings: 1 }, healthy: false },
  { name: "extra postings", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (1, 'Alpha', 'alpha beta gamma');",
    expected: { ...aligned, extraPostings: 1 }, healthy: false },
  { name: "wrong column", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (1, 'Alpha beta', 'alpha');",
    expected: { ...aligned, missingPostings: 1, extraPostings: 1 }, healthy: false },
  { name: "wrong offsets", setup: "INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (1, 'Alpha', 'beta alpha');",
    expected: { ...aligned, missingPostings: 2, extraPostings: 2 }, healthy: false },
  { name: "indexed tokenless rows", setup: tokenlessDocuments + indexDocuments,
    expected: { ...aligned, documents: 3 }, healthy: true },
  { name: "unindexed tokenless rows", setup: indexDocuments + tokenlessDocuments,
    expected: { ...aligned, documents: 3 }, healthy: true },
  { name: "only tokenless rows", setup: `DELETE FROM ask_documents; ${tokenlessDocuments}`,
    expected: { ...aligned, documents: 2, searchable: 0, indexed: 0 }, healthy: true },
  { name: "obsolete postings on now-tokenless content", setup: `${indexDocuments} UPDATE ask_documents SET title='', search_text='...';`,
    expected: { ...aligned, searchable: 0, extraPostings: 3 }, healthy: false },
  { name: "tokenless orphan has no search postings", setup: `${indexDocuments} INSERT INTO ask_documents_fts(rowid, title, search_text) VALUES (99, '', '...');`,
    expected: aligned, healthy: true },
  { name: "empty content and index", setup: "DELETE FROM ask_documents;",
    expected: { ...aligned, documents: 0, searchable: 0, indexed: 0 }, healthy: false },
];

for (const scenario of cases) {
  test(`read-only health detects ${scenario.name}, cleans TEMP, and leaves the file unchanged`, () => {
    const directory = mkdtempSync(join(tmpdir(), "public-data-health-"));
    const path = join(directory, "synthetic.sqlite");
    let database;
    try {
      database = fixture(path);
      database.exec(scenario.setup);
      database.close();
      const before = hash(path);
      database = new Database(path, { readonly: true, fileMustExist: true });
      database.exec("CREATE TEMP TABLE caller_owned (value TEXT)");
      const objects = temporaryObjects(database);
      const evidence = readPublicDataHealth(database);
      assert.deepEqual(askEvidence(evidence), scenario.expected);
      assert.equal(evidence.quickCheck, "ok");
      assert.equal(evidence.curation.x.count, 1);
      assert.equal(evidence.curation.douyin.count, 1);
      assert.equal(evidence.openSource.count, 1);
      const status = buildDataHealth({ ...base, publicData: evidence });
      assert.equal(status.askIndex.healthy, scenario.healthy);
      assert.equal(status.healthy, scenario.healthy);
      if (!scenario.healthy) assert.match(status.warnings.join("\n"), /Ask FTS/u);
      assert.deepEqual(temporaryObjects(database), objects);
      assert.deepEqual(readPublicDataHealth(database), evidence);
      assert.deepEqual(temporaryObjects(database), objects);
      assert.equal(database.inTransaction, false);
      assert.equal(database.readonly, true);
      assert.throws(() => database.exec("CREATE TABLE main.forbidden (value TEXT)"), { code: "SQLITE_READONLY" });
      database.close();
      assert.equal(hash(path), before);
    } finally {
      if (database?.open) database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("expected postings use the production tokenizer, including diacritics and non-Latin text", () => {
  const database = fixture();
  try {
    database.exec(`UPDATE ask_documents SET title='CAFÉ ộ 中文', search_text='café cafe 中文 Ελληνικά repeat repeat'; ${indexDocuments}`);
    const evidence = readPublicDataHealth(database);
    assert.deepEqual(askEvidence(evidence), aligned);
    assert.equal(database.prepare("SELECT count(*) AS count FROM ask_documents_fts WHERE ask_documents_fts MATCH 'cafe'").get().count, 1);
  } finally {
    database.close();
  }
});

test("repeated reads observe changed content and index without cached evidence", () => {
  const database = fixture();
  try {
    database.exec(indexDocuments);
    assert.deepEqual(askEvidence(readPublicDataHealth(database)), aligned);
    database.exec("UPDATE ask_documents SET search_text='alpha gamma'");
    assert.deepEqual(askEvidence(readPublicDataHealth(database)), { ...aligned, missingPostings: 1, extraPostings: 1 });
    database.exec("INSERT INTO ask_documents_fts(ask_documents_fts) VALUES ('rebuild')");
    assert.deepEqual(askEvidence(readPublicDataHealth(database)), aligned);
    assert.deepEqual(temporaryObjects(database), []);
  } finally {
    database.close();
  }
});

for (const failurePoint of [
  "CREATE VIRTUAL TABLE temp.health_ask_expected ",
  "INSERT INTO temp.health_ask_expected",
  "CREATE VIRTUAL TABLE temp.health_ask_expected_vocab",
  "WITH\n",
  "DROP TABLE temp.health_ask_expected_vocab",
]) {
  test(`failed health reads clean all acquired TEMP objects (${failurePoint.trim()})`, (context) => {
    const database = fixture();
    try {
      database.exec(indexDocuments);
      database.exec("CREATE TEMP TABLE caller_owned (value TEXT)");
      const objects = temporaryObjects(database);
      const method = failurePoint.startsWith("WITH") ? "prepare" : "exec";
      const original = database[method];
      const mocked = context.mock.method(database, method, function (sql) {
        if (sql.includes(failurePoint)) throw new Error("synthetic health failure");
        return original.call(this, sql);
      });
      // Also prove cleanup works inside a caller's transaction, before rollback.
      database.transaction(() => {
        assert.throws(() => readPublicDataHealth(database), /synthetic health failure/u);
        assert.deepEqual(temporaryObjects(database), objects);
      })();
      mocked.mock.restore();
      assert.equal(database.inTransaction, false);
      assert.deepEqual(askEvidence(readPublicDataHealth(database)), aligned);
      assert.deepEqual(temporaryObjects(database), objects);
    } finally {
      database.close();
    }
  });
}

test("query_only failure leaves no TEMP state and can recover without changing the pragma", () => {
  const database = fixture();
  try {
    database.exec(indexDocuments);
    database.pragma("query_only=ON");
    assert.throws(() => readPublicDataHealth(database), { code: "SQLITE_READONLY" });
    assert.equal(database.pragma("query_only", { simple: true }), 1);
    assert.deepEqual(temporaryObjects(database), []);
    assert.equal(database.inTransaction, false);
    database.pragma("query_only=OFF");
    assert.deepEqual(askEvidence(readPublicDataHealth(database)), aligned);
  } finally {
    database.close();
  }
});

test("healthy public projections pass through one data-health interface", () => {
  const status = buildDataHealth(base);
  assert.equal(status.healthy, true);
  assert.deepEqual(status.warnings, []);
});

test("equal Ask counts cannot hide SQLite corruption or mismatched FTS rowids", () => {
  const status = buildDataHealth({
    ...base,
    publicData: { ...base.publicData, askMissingFts: 1, askOrphanFts: 1, quickCheck: "database disk image is malformed" },
  });
  assert.equal(status.healthy, false);
  assert.equal(status.database.healthy, false);
  assert.equal(status.askIndex.healthy, false);
  assert.match(status.warnings.join("\n"), /SQLite|FTS/u);
});

test("stale X content is a warning after a verified successful sync", () => {
  const status = buildDataHealth({
    ...base,
    publicData: {
      ...base.publicData,
      curation: { ...base.publicData.curation, x: {
        count: 5, latestAt: "2026-08-20T11:00:00.000Z",
        sync: { status: "succeeded", lastStartedAt: "2026-08-29T10:00:00.000Z", lastFinishedAt: "2026-08-29T11:00:00.000Z", lastSucceededAt: "2026-08-29T11:00:00.000Z" },
      } },
    },
  });
  assert.equal(status.healthy, true);
  assert.equal(status.curation.x.freshness, "stale");
  assert.equal(status.curation.x.sync.healthy, true);
  assert.match(status.warnings.join("\n"), /X 策展.*内容/u);
});

test("a superseded X run cannot overwrite the newer run's failure", () => {
  const database = fixture();
  try {
    recordXSyncState(database, "running", "2026-08-29T11:00:00.000Z", "run-a");
    recordXSyncState(database, "running", "2026-08-29T11:01:00.000Z", "run-b");
    recordXSyncState(database, "failed", "2026-08-29T11:02:00.000Z", "run-b");
    const before = readPublicDataHealth(database).curation.x.sync;
    assert.equal(recordXSyncState(database, "succeeded", "2026-08-29T11:03:00.000Z", "run-a"), false);
    assert.deepEqual(readPublicDataHealth(database).curation.x.sync, before);
    assert.equal(before.status, "failed");
  } finally {
    database.close();
  }
});

test("X sync records survive projection rebuilds and keep last success after failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "x-sync-state-"));
  const sourcePath = join(directory, "projection.sqlite");
  const source = fixture(sourcePath);
  const rebuilt = fixture();
  try {
    recordXSyncState(source, "running", "2026-08-29T11:00:00.000Z", "rebuilt-run");
    recordXSyncState(source, "failed", "2026-08-29T11:05:00.000Z", "rebuilt-run");
    rebuilt.exec("DELETE FROM x_sync_state; DELETE FROM open_source_items");
    preserveSupplementalProjection(sourcePath, rebuilt);
    assert.deepEqual(readPublicDataHealth(rebuilt).curation.x.sync, {
      status: "failed", lastStartedAt: "2026-08-29T11:00:00.000Z",
      lastFinishedAt: "2026-08-29T11:05:00.000Z", lastSucceededAt: "2026-08-29T10:00:00.000Z",
    });
    recordXSyncState(source, "running", "2026-08-29T11:10:00.000Z", "active-run");
    rebuilt.exec("DELETE FROM x_sync_state; DELETE FROM open_source_items; DELETE FROM ask_documents WHERE source_scope = 'open-source'");
    preserveSupplementalProjection(sourcePath, rebuilt);
    assert.equal(readPublicDataHealth(rebuilt).curation.x.sync.lastFinishedAt, null);
    assert.equal(recordXSyncState(rebuilt, "succeeded", "2026-08-29T11:15:00.000Z", "active-run"), true);
    assert.equal(readPublicDataHealth(rebuilt).curation.x.sync.lastSucceededAt, "2026-08-29T11:15:00.000Z");
  } finally {
    source.close();
    rebuilt.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("adding run ownership preserves existing heartbeat timestamps", () => {
  const database = new Database(":memory:");
  try {
    database.exec(`CREATE TABLE x_sync_state (
      id INTEGER PRIMARY KEY, status TEXT NOT NULL, last_started_at TEXT NOT NULL,
      last_finished_at TEXT, last_succeeded_at TEXT
    ); INSERT INTO x_sync_state VALUES (1, 'succeeded', '2026-08-29T09:00:00.000Z',
      '2026-08-29T10:00:00.000Z', '2026-08-29T10:00:00.000Z')`);
    initializePublicDatabase(database);
    assert.equal(readPublicDataHealth(database).curation.x.sync.lastSucceededAt, "2026-08-29T10:00:00.000Z");
    assert.equal(database.prepare("SELECT run_id FROM x_sync_state").get().run_id, null);
    assert.equal(recordXSyncState(database, "failed", "2026-08-29T11:00:00.000Z", "unowned"), false);
  } finally {
    database.close();
  }
});

test("snapshots without X sync evidence remain explicitly unknown", () => {
  const database = fixture();
  try {
    database.exec("DROP TABLE x_sync_state");
    const evidence = readPublicDataHealth(database);
    assert.equal(evidence.curation.x.sync, null);
    const status = buildDataHealth({ ...base, publicData: evidence });
    assert.equal(status.curation.x.sync.status, "unknown");
    assert.equal(status.curation.x.sync.healthy, null);
    assert.equal(status.healthy, false);
    assert.match(status.warnings.join("\n"), /同步状态未知/u);
  } finally {
    database.close();
  }
});

for (const sync of [
  { ...base.publicData.curation.x.sync, status: "failed" },
  { ...base.publicData.curation.x.sync, lastSucceededAt: "2026-08-20T11:00:00.000Z" },
  { ...base.publicData.curation.x.sync, lastSucceededAt: "invalid" },
  { ...base.publicData.curation.x.sync, status: "running", lastSucceededAt: null },
]) {
  test(`recent X content cannot hide unhealthy sync ${JSON.stringify(sync)}`, () => {
    const status = buildDataHealth({ ...base, publicData: {
      ...base.publicData, curation: { ...base.publicData.curation, x: { ...base.publicData.curation.x, sync } },
    } });
    assert.equal(status.healthy, false);
    assert.equal(status.curation.x.freshness, "fresh");
    assert.equal(status.curation.x.sync.healthy, false);
  });
}

test("stale Douyin and GitHub content still fail health while missing public content fails", () => {
  const status = buildDataHealth({ ...base, publicData: {
    ...base.publicData,
    curation: { ...base.publicData.curation, douyin: { count: 5, latestAt: "2026-08-01T00:00:00.000Z" } },
    openSource: { count: 3, latestAt: "2026-08-01T00:00:00.000Z" },
  } });
  assert.equal(status.healthy, false);
  assert.equal(status.curation.douyin.healthy, false);
  assert.equal(status.openSource.healthy, false);
  assert.equal(status.curation.douyin.freshness, "stale");
  assert.equal(status.openSource.freshness, "stale");
  const missing = buildDataHealth({ ...base, publicData: {
    ...base.publicData, curation: { ...base.publicData.curation, x: { ...base.publicData.curation.x, count: 0 } },
  } });
  assert.equal(missing.healthy, false);
  assert.equal(missing.curation.x.freshness, "missing");
});

test("stale or inconsistent projections fail health with an actionable warning", () => {
  const status = buildDataHealth({
    ...base,
    publicData: {
      ...base.publicData,
      askFts: 9,
      curation: { ...base.publicData.curation, x: { count: 5, latestAt: "2026-08-20T11:00:00.000Z" } },
    },
  });
  assert.equal(status.healthy, false);
  assert.equal(status.askIndex.healthy, false);
  assert.match(status.warnings.join("\n"), /X 策展/u);
});
