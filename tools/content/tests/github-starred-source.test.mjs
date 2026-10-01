import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildRepositoryStructureMarkdown, isChineseMarkdown } from "../modules/github-starred/github-api.mjs";
import {
  readLocalSourceRecords,
  syncRepositorySource,
  syncStarredRepositories,
} from "../modules/github-starred/source.mjs";

test("README 缺失时以仓库结构作为原始证据", () => {
  const markdown = buildRepositoryStructureMarkdown(
    { fullName: "example/no-readme" },
    [
      { path: "src", type: "dir" },
      { path: "package.json", type: "file" },
    ],
    { "package.json": '{"name":"no-readme"}' },
  );
  assert.match(markdown, /README 不存在/u);
  assert.match(markdown, /\[dir\] src/u);
  assert.match(markdown, /## package\.json/u);
});

test("原始中文 README 直接成为中文阅读版", async () => {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-source-"));
  try {
    const record = await Effect.runPromise(
      syncRepositorySource(
        {
          defaultBranch: "main",
          fullName: "example/chinese-readme",
          nodeId: "node-cn",
          repositoryUrl: "https://github.com/example/chinese-readme",
        },
        {
          rawRoot,
          exec: async () => ({
            stdout: "# 示例\n\n这是仓库维护的中文 README，包含足够多的说明文字用于识别中文原文，而不是模型翻译结果。\n",
          }),
        },
      ),
    );
    assert.equal(isChineseMarkdown(record.sourceMarkdown), true);
    assert.equal(record.readingMarkdown, record.sourceMarkdown);
    assert.equal(record.readingSourcePath, "README");
    const [reloaded] = await Effect.runPromise(readLocalSourceRecords(rawRoot));
    assert.equal(reloaded.readingMarkdown, record.sourceMarkdown);
  } finally {
    await rm(rawRoot, { force: true, recursive: true });
  }
});

test("每日增量同步只重新读取新增或更新过的 Star 仓库", async () => {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-incremental-"));
  try {
    const repository = (fullName, nodeId, updatedAt) => ({
      defaultBranch: "main",
      description: `${fullName} description`,
      fullName,
      nodeId,
      repositoryUrl: `https://github.com/${fullName}`,
      updatedAt,
    });
    const unchanged = {
      readingMarkdown: null,
      readingSourcePath: null,
      readingTruncated: false,
      repository: repository("example/unchanged", "node-unchanged", "2026-08-01T00:00:00.000Z"),
      sourceFetchedAt: "2026-08-01T00:00:00.000Z",
      sourceKind: "readme",
      sourceLanguage: "other",
      sourceMarkdown: "# Unchanged\n",
      sourceSha256: "unchanged-sha",
      sourceStructure: null,
      sourceTruncated: false,
    };
    const stale = {
      ...unchanged,
      repository: repository("example/updated", "node-updated", "2026-08-01T00:00:00.000Z"),
      sourceMarkdown: "# Stale\n",
      sourceSha256: "stale-sha",
    };
    const calls = [];
    const records = await Effect.runPromise(
      syncStarredRepositories({
        existingRecords: [unchanged, stale],
        incremental: true,
        rawRoot,
        repositories: [
          unchanged.repository,
          repository("example/updated", "node-updated", "2026-08-02T00:00:00.000Z"),
          repository("example/new", "node-new", "2026-08-02T00:00:00.000Z"),
        ],
        exec: async (_command, args) => {
          calls.push(args[1]);
          return { stdout: args[1].endsWith("/readme") ? "# Updated\n" : "[]" };
        },
      }),
    );
    assert.deepEqual(
      records.changedRecords.map((record) => record.repository.fullName),
      ["example/new", "example/updated"],
    );
    assert.equal(
      calls.some((path) => path.includes("example/unchanged")),
      false,
    );
    assert.equal(calls.filter((path) => path.endsWith("/readme")).length, 2);
    const reloaded = await Effect.runPromise(readLocalSourceRecords(rawRoot));
    assert.equal(
      reloaded.find((record) => record.repository.fullName === "example/unchanged").sourceMarkdown,
      "# Unchanged\n",
    );
    assert.equal(
      reloaded.find((record) => record.repository.fullName === "example/updated").repository.updatedAt,
      "2026-08-02T00:00:00.000Z",
    );
  } finally {
    await rm(rawRoot, { force: true, recursive: true });
  }
});
