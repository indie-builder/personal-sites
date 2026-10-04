import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { readPublicDataHealth } from "../src/data-health/sqlite.mjs";
import { buildDataHealth } from "../src/data-health/status.mjs";
import { initializePublicDatabase } from "../src/sqlite.mjs";

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
      x: { count: 5, latestAt: "2026-08-29T11:00:00.000Z" },
    },
    openSource: { count: 3, latestAt: "2026-08-28T12:00:00.000Z" },
    quickCheck: "ok",
  },
};

function fixture(path = ":memory:") {
  const database = initializePublicDatabase(new Database(path));
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
