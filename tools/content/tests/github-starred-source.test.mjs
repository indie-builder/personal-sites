import { Cause, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { fetchReadme, isChineseMarkdown, listStarredRepositories } from "../modules/github-starred/github-api.mjs";
import {
  readLocalSourceRecords,
  syncRepositorySource,
  syncStarredRepositories,
} from "../modules/github-starred/source.mjs";

const emptyStarredPage = JSON.stringify({
  data: { viewer: { starredRepositories: { edges: [], pageInfo: { hasNextPage: false } } } },
});

for (const message of [
  'Post "https://api.github.com/graphql": unexpected EOF',
  "EOF",
  'Get "https://api.github.com/repos/example/test/readme": EOF',
  "read: connection reset by peer",
  "ECONNRESET",
  "ETIMEDOUT",
  "i/o timeout",
  "TLS handshake timeout",
  "temporary timeout",
  "HTTP 502 Bad Gateway",
  "HTTP 503 Service Unavailable",
  "HTTP 504 Gateway Timeout",
]) {
  test(`gh retries transient failure once before success: ${message}`, async () => {
    let calls = 0;
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(fetchReadme({ fullName: "example/test" }, {
        exec: async () => {
          calls += 1;
          if (calls === 1) throw Object.assign(new Error("gh failed"), { stderr: message });
          return { stdout: "# Fixture README" };
        },
      }));
      yield* TestClock.adjust("999 millis");
      assert.equal(calls, 1);
      yield* TestClock.adjust("1 millis");
      assert.equal(yield* Fiber.join(fiber), "# Fixture README");
      assert.equal(calls, 2);
    }).pipe(Effect.provide(TestClock.layer()), Effect.scoped));
  });
}

for (const failures of [2, 3]) {
  test(`GraphQL retries at most twice after ${failures} transient failures`, async () => {
    let calls = 0;
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.exit(listStarredRepositories({
        exec: async (_command, args) => {
          assert.equal(args[1], "graphql");
          calls += 1;
          if (calls <= failures) throw new Error("unexpected EOF");
          return { stdout: emptyStarredPage };
        },
      })));
      yield* TestClock.adjust("999 millis");
      assert.equal(calls, 1);
      yield* TestClock.adjust("1 millis");
      assert.equal(calls, 2);
      yield* TestClock.adjust("999 millis");
      assert.equal(calls, 2);
      yield* TestClock.adjust("1 millis");
      assert.equal(calls, 3);
      yield* TestClock.adjust("10 seconds");
      const exit = yield* Fiber.join(fiber);
      assert.equal(exit._tag, failures === 2 ? "Success" : "Failure");
      if (exit._tag === "Success") assert.deepEqual(exit.value, []);
      else {
        assert.equal(Cause.hasFails(exit.cause), true);
        assert.equal(Cause.hasDies(exit.cause), false);
      }
      assert.equal(calls, 3);
    }).pipe(Effect.provide(TestClock.layer()), Effect.scoped));
  });
}

for (const error of [
  new Error("HTTP 404 Not Found"),
  new Error("HTTP 401 Bad credentials\nunexpected EOF"),
  new Error("gh auth login"),
  new Error("HTTP 403 Forbidden\nunexpected EOF"),
  new Error("permission denied\nunexpected EOF"),
  new Error("unknown flag: --invalid\nunexpected EOF"),
  new Error("invalid argument\nunexpected EOF"),
  new Error("request canceled\nunexpected EOF"),
  Object.assign(new Error("unexpected EOF"), { name: "AbortError", code: "ABORT_ERR" }),
  Object.assign(new Error("unexpected EOF"), { signal: "SIGTERM", killed: true }),
  new Error("unrecognized failure"),
  new Error("invalid EOF marker"),
]) {
  test(`gh does not retry permanent or cancelled failure: ${error.message.split("\n")[0]}`, async () => {
    let calls = 0;
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.exit(fetchReadme({ fullName: "example/test" }, {
        exec: async () => { calls += 1; throw error; },
      })));
      yield* TestClock.adjust("10 seconds");
      const exit = yield* Fiber.join(fiber);
      if (error.message.includes("404")) {
        assert.equal(exit._tag, "Success");
        assert.equal(exit.value, null);
      } else {
        assert.equal(exit._tag, "Failure");
        assert.equal(Cause.hasDies(exit.cause), false);
      }
      assert.equal(calls, 1);
    }).pipe(Effect.provide(TestClock.layer()), Effect.scoped));
  });
}

for (const pending of [false, true]) {
  test(`gh cancellation stops ${pending ? "in-flight exec" : "retry delay"}`, async () => {
    let calls = 0;
    let signal;
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(fetchReadme({ fullName: "example/test" }, {
        exec: (_command, _args, options) => {
          calls += 1;
          signal = options.signal;
          if (!pending) return Promise.reject(new Error("unexpected EOF"));
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("unexpected EOF")), { once: true });
          });
        },
      }));
      yield* TestClock.adjust("500 millis");
      assert.equal(calls, 1);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber);
      assert.equal(exit._tag, "Failure");
      assert.equal(Cause.hasInterruptsOnly(exit.cause), true);
      if (pending) assert.equal(signal.aborted, true);
      yield* TestClock.adjust("10 seconds");
      assert.equal(calls, 1);
    }).pipe(Effect.provide(TestClock.layer()), Effect.scoped));
  });
}

test("invalid GraphQL JSON is a typed failure without reissuing gh", async () => {
  let calls = 0;
  const error = await Effect.runPromise(listStarredRepositories({
    exec: async () => { calls += 1; return { stdout: "{invalid json" }; },
  }).pipe(Effect.catch((failure) => Effect.succeed(failure))));
  assert.equal(error._tag, "OperationError");
  assert.equal(error.operation, "github.json");
  assert.ok(error.cause instanceof SyntaxError);
  assert.equal(calls, 1);
});

test("README 缺失时以仓库结构作为原始证据", async () => {
  const root = [
    { name: "src", path: "src", type: "dir", size: 0 },
    { name: "package.json", path: "package.json", type: "file", size: 20 },
  ];
  const manifest = '{"name":"no-readme"}';
  const record = await Effect.runPromise(syncRepositorySource(
    { fullName: "example/no-readme", defaultBranch: "main" },
    {
      exec: async (_command, args) => {
        if (args[1] === "repos/example/no-readme/readme") throw new Error("HTTP 404 Not Found");
        if (args[1] === "repos/example/no-readme/contents?ref=main") return { stdout: JSON.stringify(root) };
        if (args[1] === "repos/example/no-readme/contents/package.json") return { stdout: manifest };
        assert.fail(`Unexpected fixture request: ${args[1]}`);
      },
    },
  ));
  assert.equal(record.sourceKind, "repository");
  assert.match(record.sourceMarkdown, /README 不存在/u);
  assert.match(record.sourceMarkdown, /\[dir\] src/u);
  assert.match(record.sourceMarkdown, /## package\.json/u);
  assert.ok(record.sourceMarkdown.includes(manifest));
  assert.deepEqual(record.sourceStructure, {
    root: [root[1], root[0]],
    manifests: { "package.json": manifest },
  });
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

test("Star 同步按指定并发上限读取仓库并发布全部完成结果", async () => {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-concurrency-"));
  let active = 0;
  let maximum = 0;
  try {
    const records = await Effect.runPromise(syncStarredRepositories({
      concurrency: 2,
      rawRoot,
      repositories: Array.from({ length: 5 }, (_, index) => ({
        defaultBranch: "main", fullName: `example/repo-${index}`, nodeId: `node-${index}`,
        repositoryUrl: `https://github.com/example/repo-${index}`,
      })),
      exec: async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { stdout: "# 示例\n\n这是仓库维护的中文 README，包含足够多的说明文字用于识别中文原文，而不是模型翻译结果。\n" };
        } finally {
          active -= 1;
        }
      },
    }));
    assert.equal(maximum, 2);
    assert.equal(active, 0);
    assert.equal(records.length, 5);
    assert.equal((await Effect.runPromise(readLocalSourceRecords(rawRoot))).length, 5);
  } finally {
    await rm(rawRoot, { force: true, recursive: true });
  }
});
