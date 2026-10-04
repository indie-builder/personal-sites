import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { publishStarredRecords } from "../modules/github-starred/publish-to-sqlite.mjs";

function publicationFixture(fullName, nodeId, slug, { defaultBranch, sourceMarkdown = "# Original README\n" } = {}) {
  const repositoryUrl = `https://github.com/${fullName}`;
  return {
    record: {
      repository: { fullName, nodeId, repositoryUrl, starredAt: null, ...(defaultBranch ? { defaultBranch } : {}) },
      sourceFetchedAt: "2026-08-09T00:00:00.000Z",
      sourceKind: "readme",
      sourceMarkdown,
      sourceSha256: "sha",
      sourceStructure: null,
      sourceTruncated: false,
    },
    entry: {
      category: "skills",
      dimensions: ["agent-skills"],
      evidence: {
        checkedAt: "2026-08-09",
        kind: "readme",
        label: "README.md",
        note: "来源",
        url: `${repositoryUrl}/blob/main/README.md`,
      },
      personalNote: "备注",
      repository: fullName,
      slug,
      sourceSummary: "摘要",
      status: "持续跟踪",
      type: "Skill",
    },
  };
}

test("公开投影只携带选中的单仓库资料及双版本 Markdown", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-projection-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/repo", "node-1", "example-repo", { defaultBranch: "main" });
  record.readingSourcePath = null;
  const unselected = publicationFixture("example/unselected", "node-unselected", "unselected");
  const analysis = {
    contentMarkdown: "# 中文阅读版\n",
    model: { model: "gpt-5.6-luna", provider: "codex-cli" },
    oneLineSummary: "模型生成的一句话简介。",
    repoNodeId: "node-1",
  };
  let database;
  try {
    await Effect.runPromise(publishStarredRecords({
      analyses: [analysis, { ...analysis, repoNodeId: "node-unselected" }],
      databasePath,
      now: "2026-08-09T00:00:00.000Z",
      records: [record, unselected.record],
      seedEntries: [{ repository: "example/padding-1" }, { repository: "example/padding-2" }, entry],
    }));
    database = new Database(databasePath, { readonly: true });
    const [item] = database.prepare("SELECT * FROM open_source_items").all();
    assert.equal(database.prepare("SELECT count(*) AS count FROM open_source_items").get().count, 1);
    assert.equal(item.repo_node_id, "node-1");
    assert.equal(item.slug, "example-repo");
    assert.equal(item.display_rank, 2);
    assert.equal(item.published_at, "2026-08-09T00:00:00.000Z");
    const content = JSON.parse(item.content_json);
    assert.equal(content.sourceMarkdown, "# Original README\n");
    assert.equal(content.parsedMarkdown, "# 中文阅读版\n");
    assert.equal(content.sourceSummary, "模型生成的一句话简介。");
    assert.equal(content.repositoryUrl, record.repository.repositoryUrl);
    assert.equal(content.readingSource, "model-translation");
    assert.equal(content.readingSourcePath, null);
    assert.equal(content.repositoryDefaultBranch, "main");
    assert.deepEqual(Object.keys(content).sort(), [
      "category", "dimensions", "evidence", "parsedMarkdown", "personalNote",
      "readingSource", "readingSourcePath", "repository", "repositoryDefaultBranch",
      "repositoryUrl", "slug", "sourceMarkdown", "sourceSummary", "status", "type",
    ]);
  } finally {
    database?.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("官方中文 README 发布保留来源标记，缺失字段在 JSON 中省略且简介回退种子资料", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-official-projection-"));
  const databasePath = path.join(directory, "public.sqlite");
  const official = publicationFixture("example/official", "node-cn", "official");
  official.record.readingMarkdown = "# 官方中文 README\n";
  official.record.readingSourcePath = "README.zh-CN.md";
  const translated = publicationFixture("example/translated", "node-translated", "translated");
  let database;
  try {
    await Effect.runPromise(publishStarredRecords({
      analyses: [
        { contentMarkdown: official.record.readingMarkdown, repoNodeId: "node-cn" },
        { contentMarkdown: "# 中文阅读版\n", repoNodeId: "node-translated" },
      ],
      databasePath,
      records: [official.record, translated.record],
      seedEntries: [official.entry, translated.entry],
    }));
    database = new Database(databasePath, { readonly: true });
    const contents = Object.fromEntries(database.prepare("SELECT repo_node_id, content_json FROM open_source_items").all()
      .map((row) => [row.repo_node_id, JSON.parse(row.content_json)]));
    assert.equal(contents["node-cn"].readingSource, "official-zh-readme");
    assert.equal(contents["node-cn"].readingSourcePath, "README.zh-CN.md");
    assert.equal(contents["node-cn"].parsedMarkdown, official.record.readingMarkdown);
    assert.equal(contents["node-cn"].sourceMarkdown, official.record.sourceMarkdown);
    assert.equal(contents["node-cn"].sourceSummary, official.entry.sourceSummary);
    assert.equal(contents["node-translated"].readingSource, "model-translation");
    assert.equal(Object.hasOwn(contents["node-translated"], "readingSourcePath"), false);
    assert.equal(Object.hasOwn(contents["node-translated"], "repositoryDefaultBranch"), false);
  } finally {
    database?.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("发布器把公开投影和问答分块写入本地 SQLite", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-sqlite-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/repo", "node-1", "example-repo");
  const analysis = {
    contentMarkdown: "# 中文阅读版\n",
    generatedAt: "2026-08-09T00:00:00.000Z",
    model: { provider: "bigmodel-coding", model: "glm-5.3-flash" },
    oneLineSummary: "智谱 GLM 生成的一句话简介。",
    parserVersion: "test",
    repoNodeId: "node-1",
    repository: "example/repo",
    sourceKind: "readme",
    sourceSha256: "sha",
    summaryModel: { provider: "bigmodel-coding", model: "glm-5.3-flash" },
    summaryVersion: "test-summary",
  };
  let database;
  try {
    const result = await Effect.runPromise(
      publishStarredRecords({ analyses: [analysis], databasePath, records: [record], seedEntries: [entry] }),
    );
    assert.deepEqual(result, { indexedCount: 1, privateAnalysisCount: 1, privateSourceCount: 1, publicCount: 1 });
    database = new Database(databasePath, { readonly: true });
    assert.deepEqual(database.prepare("SELECT repo_node_id, slug FROM open_source_items").all(), [
      { repo_node_id: "node-1", slug: "example-repo" },
    ]);
    assert.deepEqual(
      database.prepare("SELECT source_id, source_url FROM ask_documents WHERE source_scope = 'open-source'").all(),
      [{ source_id: "node-1", source_url: "/open-source/example-repo#中文阅读版" }],
    );
  } finally {
    database?.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("重复发布记录拒绝写入并保留原投影和问答索引", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-duplicate-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/repo", "node-1", "example-repo");
  const original = { contentMarkdown: "# Original\n\noriginaltoken", repoNodeId: "node-1" };
  let database;
  try {
    await Effect.runPromise(publishStarredRecords({
      analyses: [original], databasePath, records: [record], seedEntries: [entry],
    }));
    await assert.rejects(Effect.runPromise(publishStarredRecords({
      analyses: [{ ...original, contentMarkdown: "# Replacement\n\nreplacementtoken" }],
      databasePath, records: [record, record], seedEntries: [entry],
    })));

    database = new Database(databasePath, { readonly: true });
    assert.equal(database.prepare("SELECT count(*) AS count FROM open_source_items").get().count, 1);
    const content = JSON.parse(database.prepare("SELECT content_json FROM open_source_items").get().content_json);
    assert.equal(content.parsedMarkdown, original.contentMarkdown);
    assert.deepEqual(database.prepare(
      "SELECT source_url FROM ask_documents WHERE source_scope = 'open-source'",
    ).all(), [{ source_url: "/open-source/example-repo#original" }]);
    assert.equal(database.prepare(
      "SELECT count(*) AS count FROM ask_documents_fts WHERE ask_documents_fts MATCH 'originaltoken'",
    ).get().count, 1);
    assert.equal(database.prepare(
      "SELECT count(*) AS count FROM ask_documents_fts WHERE ask_documents_fts MATCH 'replacementtoken'",
    ).get().count, 0);
  } finally {
    database?.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("撤回公开仓库时删除本地投影和问答分块", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-withdraw-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/withdrawn", "node-withdrawn", "example-withdrawn", {
    sourceMarkdown: "# README\n",
  });
  const analysis = { contentMarkdown: "# 中文阅读版\n", oneLineSummary: "简介", repoNodeId: "node-withdrawn" };
  let database;
  try {
    await Effect.runPromise(
      publishStarredRecords({ analyses: [analysis], databasePath, records: [record], seedEntries: [entry] }),
    );
    await Effect.runPromise(publishStarredRecords({ databasePath, records: [record] }));
    database = new Database(databasePath, { readonly: true });
    assert.equal(database.prepare("SELECT count(*) AS count FROM open_source_items").get().count, 0);
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM ask_documents WHERE source_scope = 'open-source'").get().count,
      0,
    );
  } finally {
    database?.close();
    await rm(directory, { force: true, recursive: true });
  }
});
