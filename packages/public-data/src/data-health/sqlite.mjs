function readAskIndexHealth(database) {
  const temporaryTables = [];
  const create = (name, definition) => {
    database.exec(`CREATE VIRTUAL TABLE temp.${name} USING ${definition}`);
    temporaryTables.push(name);
  };
  try {
    // External-content FTS SELECTs read ask_documents, not the index. Instance
    // vocabularies expose actual (term, document, column, offset) postings.
    create("health_ask_actual", "fts5vocab(main, ask_documents_fts, 'instance')");
    // Keep columns and tokenizer identical to initializePublicDatabase. Content
    // is unnecessary in this scratch index; only its postings are inspected.
    create("health_ask_expected", "fts5(title, search_text, content='', tokenize='unicode61 remove_diacritics 2')");
    database.exec(`INSERT INTO temp.health_ask_expected(rowid, title, search_text)
      SELECT rowid, title, search_text FROM main.ask_documents`);
    create("health_ask_expected_vocab", "fts5vocab(temp, health_ask_expected, 'instance')");
    return database.prepare(`WITH
      expected AS MATERIALIZED (SELECT DISTINCT doc FROM temp.health_ask_expected_vocab),
      actual AS MATERIALIZED (SELECT DISTINCT doc FROM temp.health_ask_actual)
      SELECT
        (SELECT count(*) FROM main.ask_documents) AS documents,
        (SELECT count(*) FROM expected) AS searchable_documents,
        (SELECT count(*) FROM actual) AS fts,
        (SELECT count(*) FROM (SELECT doc FROM expected EXCEPT SELECT doc FROM actual)) AS missing_fts,
        (SELECT count(*) FROM (SELECT doc FROM actual EXCEPT SELECT rowid FROM main.ask_documents)) AS orphan_fts,
        (SELECT count(*) FROM (
          SELECT term, doc, col, offset FROM temp.health_ask_expected_vocab
          EXCEPT SELECT term, doc, col, offset FROM temp.health_ask_actual
        )) AS missing_postings,
        (SELECT count(*) FROM (
          SELECT term, doc, col, offset FROM temp.health_ask_actual
          EXCEPT SELECT term, doc, col, offset FROM temp.health_ask_expected_vocab
        )) AS extra_postings`).get();
  } finally {
    for (const name of temporaryTables.reverse()) database.exec(`DROP TABLE temp.${name}`);
  }
}

export function readPublicDataHealth(database) {
  // One snapshot, including the content used to construct the expected index.
  // Only TEMP is written, so the main connection can remain readonly.
  return database.transaction(() => {
    const platforms = new Map(database.prepare(`SELECT json_extract(content_json, '$.source.platform') AS platform,
      count(*) AS count, max(coalesce(collected_at, published_at)) AS latest
      FROM curation_items GROUP BY platform`).all().map((row) => [row.platform, row]));
    const ask = readAskIndexHealth(database);
    const openSource = database.prepare("SELECT count(*) AS count, max(published_at) AS latest FROM open_source_items").get();
    return {
      askDocuments: Number(ask.documents),
      askSearchableDocuments: Number(ask.searchable_documents),
      askFts: Number(ask.fts),
      askMissingFts: Number(ask.missing_fts),
      askOrphanFts: Number(ask.orphan_fts),
      askMissingPostings: Number(ask.missing_postings),
      askExtraPostings: Number(ask.extra_postings),
      curation: {
        douyin: { count: Number(platforms.get("douyin")?.count ?? 0), latestAt: platforms.get("douyin")?.latest ?? null },
        x: { count: Number(platforms.get("x")?.count ?? 0), latestAt: platforms.get("x")?.latest ?? null },
      },
      openSource: { count: Number(openSource.count), latestAt: openSource.latest ?? null },
      quickCheck: String(database.pragma("quick_check", { simple: true })),
    };
  })();
}
