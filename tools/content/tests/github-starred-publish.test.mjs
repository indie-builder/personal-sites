import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { publishStarredRecords, toPublicOpenSourceItem } from "../modules/github-starred/publish-to-sqlite.mjs";

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
      category: "skills", caveats: [], dimensions: ["agent-skills"],
      evidence: { checkedAt: "2026-08-09", kind: "readme", label: "README.md", note: "来源", url: `${repositoryUrl}/blob/main/README.md` },
      judgement: "判断", nextStep: "下一步", personalNote: "备注", repository: fullName,
      scenarios: [], slug, sourceSummary: "摘要", status: "持续跟踪", type: "Skill", workflow: [],
    },
  };
}

test("公开投影只携带选中的单仓库资料及双版本 Markdown", () => {
  const { record, entry } = publicationFixture("example/repo", "node-1", "example-repo", { defaultBranch: "main" });
  const analysis = {
    contentMarkdown: "# 中文阅读版\n",
    model: { model: "gpt-5.6-luna", provider: "codex-cli" },
    oneLineSummary: "模型生成的一句话简介。",
  };
  const item = toPublicOpenSourceItem(record, analysis, entry, 2, "2026-08-09T00:00:00.000Z");
  assert.equal(item.repo_node_id, "node-1");
  assert.equal(item.display_rank, 2);
  assert.equal(item.content.sourceMarkdown, "# Original README\n");
  assert.equal(item.content.parsedMarkdown, "# 中文阅读版\n");
  assert.equal(item.content.sourceSummary, "模型生成的一句话简介。");
  assert.equal(item.content.repositoryUrl, record.repository.repositoryUrl);
  assert.equal(item.content.readingSource, "model-translation");
  assert.equal(item.content.repositoryDefaultBranch, "main");
});

test("发布器把公开投影和问答分块写入本地 SQLite", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-sqlite-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/repo", "node-1", "example-repo");
  const analysis = { contentMarkdown: "# 中文阅读版\n", generatedAt: "2026-08-09T00:00:00.000Z", model: { provider: "bigmodel-coding", model: "glm-5.3-flash" }, oneLineSummary: "智谱 GLM 生成的一句话简介。", parserVersion: "test", repoNodeId: "node-1", repository: "example/repo", sourceKind: "readme", sourceSha256: "sha", summaryModel: { provider: "bigmodel-coding", model: "glm-5.3-flash" }, summaryVersion: "test-summary" };
  try {
    const result = await publishStarredRecords({ analyses: [analysis], databasePath, records: [record], seedEntries: [entry] });
    assert.deepEqual(result, { indexedCount: 1, privateAnalysisCount: 1, privateSourceCount: 1, publicCount: 1 });
    const database = new Database(databasePath, { readonly: true });
    assert.deepEqual(database.prepare("SELECT repo_node_id, slug FROM open_source_items").all(), [
      { repo_node_id: "node-1", slug: "example-repo" },
    ]);
    assert.deepEqual(database.prepare("SELECT source_id, source_url FROM ask_documents WHERE source_scope = 'open-source'").all(), [
      { source_id: "node-1", source_url: "/open-source/example-repo#中文阅读版" },
    ]);
    database.close();
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("撤回公开仓库时删除本地投影和问答分块", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "github-starred-withdraw-"));
  const databasePath = path.join(directory, "public.sqlite");
  const { record, entry } = publicationFixture("example/withdrawn", "node-withdrawn", "example-withdrawn", { sourceMarkdown: "# README\n" });
  const analysis = { contentMarkdown: "# 中文阅读版\n", oneLineSummary: "简介", repoNodeId: "node-withdrawn" };
  try {
    await publishStarredRecords({ analyses: [analysis], databasePath, records: [record], seedEntries: [entry] });
    await publishStarredRecords({ databasePath, records: [record] });
    const database = new Database(databasePath, { readonly: true });
    assert.equal(database.prepare("SELECT count(*) AS count FROM open_source_items").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM ask_documents WHERE source_scope = 'open-source'").get().count, 0);
    database.close();
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
