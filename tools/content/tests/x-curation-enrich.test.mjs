import { Cause, Effect, Exit, Fiber } from "effect";
import { OperationError } from "@site/effect";
import { isTransientModelError, withModelRetry } from "../modules/analysis/retry.mjs";
import { TestClock } from "effect/testing";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareCurationItem } from "../modules/x-sync/analysis.mjs";

const cliUrl = new URL("../scripts/x-curation-enrich.mjs", import.meta.url);
const repoRoot = path.resolve(path.dirname(cliUrl.pathname), "../../..");
const configPath = path.join(repoRoot, "config/x-curation.json");

function mockCliAdapters(key, state) {
  const mockExports = new Map([
    ["node:fs/promises", ["readFile"]],
    ["../../../scripts/lib/load-local-env.mjs", ["loadLocalEnv"]],
    ["../lib/pi-runtime.mjs", ["resolvePiModelConfig"]],
    ["../modules/analysis/readers.mjs", ["createAnalysisReader"]],
    ["../modules/x-sync/link-content.mjs", ["expandUrl", "classifyUrl", "fetchGithubRepo", "fetchArticleText"]],
    ["../modules/x-sync/design-media.mjs", ["collectDesignEvidenceImages"]],
    ["../modules/x-sync/prompts.mjs", ["buildPrompt", "buildDesignPrompt", "parseJsonResponse", "parseDesignResponse"]],
    ["./lib/atomic-file.mjs", ["writeTextAtomically"]],
  ]);
  if (state.runCli) mockExports.set("@site/effect/cli", ["runCli"]);
  const sources = new Map();
  for (const [specifier, names] of mockExports) {
    const url = `site-enrich-test:${key}/${encodeURIComponent(specifier)}`;
    sources.set(url, names.map((name) =>
      `export const ${name} = globalThis[${JSON.stringify(key)}].${Object.hasOwn(state, name) ? name : `forbidden(${JSON.stringify(name)})`};`,
    ).join("\n"));
  }
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL?.startsWith(cliUrl.href) && mockExports.has(specifier)) {
        return { url: `site-enrich-test:${key}/${encodeURIComponent(specifier)}`, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (sources.has(url)) return { format: "module", source: sources.get(url), shortCircuit: true };
      return nextLoad(url, context);
    },
  });
}

function fixtureItems() {
  const item = {
    author: { handle: "fixture", name: "Fixture" },
    fetchSource: "bookmarks",
    text: "Synthetic curation item",
    links: [
      { original: "https://t.co/fixture", type: "unexpanded" },
      { original: "https://github.com/example/fixture", expanded: "https://github.com/example/fixture", type: "github" },
      { original: "https://example.com/article", expanded: "https://example.com/article", type: "article" },
    ],
    media: [{ type: "photo", url: "https://example.com/image.png" }],
  };
  return [
    { ...item, id: "pending", ai: {} },
    { ...item, id: "enriched", ai: { enrichedAt: "2026-01-01T00:00:00Z" } },
    { ...item, id: "old-design", ai: { enrichedAt: "2026-01-01T00:00:00Z", design: { relevant: true, status: "unclassified" } } },
  ];
}

const cases = [
  { name: "normal", args: [], ids: ["pending"] },
  { name: "design-only", args: ["--design-only"], ids: ["enriched"] },
  { name: "refresh", args: ["--refresh"], ids: ["pending", "enriched", "old-design"] },
  { name: "design refresh", args: ["--design-only", "--refresh"], ids: ["enriched", "old-design"] },
  { name: "filtered and limited", args: ["--refresh", "--only=enriched,old-design", "--limit=1"], ids: ["enriched"] },
  { name: "zero targets", args: ["--only=missing"], ids: [] },
];

for (const normalized of [false, true]) {
  for (const scenario of cases) {
    test(`dry-run ${scenario.name} leaves ${normalized ? "normalized" : "legacy"} queue bytes and adapters untouched`, async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "site-enrich-dry-run-"));
      const queuePath = path.join(directory, "queue.json");
      const items = fixtureItems().map((item) => normalized
        ? prepareCurationItem({ ...item, ai: item.ai.design ? { ...item.ai, design: { ...item.ai.design, status: "include" } } : item.ai }, { now: new Date("2026-01-01T00:00:00Z") })
        : item);
      const bytes = `${JSON.stringify({ version: normalized ? 3 : 1, items }, null, 2)}\n`;
      const key = `enrichTest_${normalized}_${scenario.name.replaceAll(" ", "_")}`;
      const logs = [];
      const reads = [];
      const externalCalls = [];
      let envLoads = 0;
      const state = {
        readFile: async (filePath, encoding) => {
          reads.push(filePath);
          if (filePath === configPath) return JSON.stringify({ queueFile: path.relative(repoRoot, queuePath), taxonomy: [] });
          assert.equal(filePath, queuePath, "only the synthetic queue can be read");
          return readFile(queuePath, encoding);
        },
        loadLocalEnv: () => { envLoads += 1; },
        resolvePiModelConfig: () => ({ provider: "fixture", model: "fixture" }),
        forbidden: (name) => () => {
          externalCalls.push(name);
          assert.fail(`dry-run invoked external adapter: ${name}`);
        },
      };
      const originalArgs = process.argv;
      const originalLog = console.log;
      const originalFetch = globalThis.fetch;
      let hooks;
      try {
        await writeFile(queuePath, bytes);
        globalThis[key] = state;
        globalThis.fetch = state.forbidden("fetch");
        console.log = (...values) => logs.push(values.join(" "));
        process.argv = [process.execPath, `${cliUrl.pathname}?${key}`, "--dry-run", ...scenario.args];
        hooks = mockCliAdapters(key, state);
        // Import only after all module-scope config/environment and I/O adapters are mocked.
        await import(`${cliUrl.href}?${key}`);
        assert.equal(await readFile(queuePath, "utf8"), bytes);
        assert.deepEqual(reads, [configPath, queuePath]);
        assert.equal(envLoads, 1);
        assert.deepEqual(externalCalls, []);
        const previews = logs.filter((line) => line.startsWith("[dry-run]"));
        assert.deepEqual(previews.map((line) => line.split(" ")[1]), scenario.ids);
        assert.ok(logs.some((line) => line.includes(`: ${scenario.ids.length} 条`)));
        for (const preview of previews) {
          assert.match(preview, /现有链接类型 unexpanded、github、article，未展开 1\/3，媒体 1；计划：/u);
          assert.match(preview, scenario.args.includes("--design-only") ? /补设计分类/u : /展开 1 条短链、抓取 2 条已解析链接/u);
        }
      } finally {
        hooks?.deregister();
        console.log = originalLog;
        process.argv = originalArgs;
        globalThis.fetch = originalFetch;
        delete globalThis[key];
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}

test("model retry recognizes explicit transient causes and refuses permanent or ambiguous errors", () => {
  for (const error of [
    new Error("HTTP 503"), { status: 429 }, { statusCode: 502 },
    new OperationError("pi.prompt", new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })),
    new Error("智谱 GLM 请求超时（240 秒）。"),
  ]) assert.equal(isTransientModelError(error), true);
  for (const error of [
    new Error("HTTP 401 fetch failed"), { status: 400 },
    new Error("authentication failed: HTTP 503"), new Error("invalid request: service unavailable"),
    new SyntaxError("HTTP 503"), new Error("expected 503 characters"), new Error("unknown model failure"),
    { name: "AbortError", message: "fetch failed" }, { code: "ABORT_ERR", message: "network error" },
    new Error("缺少 BIGMODEL_API_KEY"),
  ]) assert.equal(isTransientModelError(error), false);
  const cyclic = new Error("ambiguous");
  cyclic.cause = cyclic;
  assert.equal(isTransientModelError(cyclic), false);
});

test("model retry propagates cancellation without repeating the request", async () => {
  let calls = 0;
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(Effect.suspend(() => {
      calls += 1;
      return Effect.fail(new Error("HTTP 503"));
    }).pipe(withModelRetry));
    yield* TestClock.adjust("1 second");
    yield* Fiber.interrupt(fiber);
    yield* TestClock.adjust("10 seconds");
    const exit = yield* Fiber.await(fiber);
    assert.ok(Exit.isFailure(exit));
    assert.ok(Cause.hasInterrupts(exit.cause));
  })).pipe(Effect.provide(TestClock.layer())));
  assert.equal(calls, 1);
});

for (const scenario of [
  { failures: 0 }, { failures: 1 }, { failures: 2 },
  { failures: 1, permanent: true }, { failures: 0, badJson: true },
]) {
  const { failures, permanent = false, badJson = false } = scenario;
  const expectedCalls = failures === 0 || permanent ? 1 : 2;
  const expectedFailure = failures === 2 || permanent || badJson;
  test(`enrich CLI handles ${JSON.stringify(scenario)} without retrying parsing or permanent failures`, async () => {
    const key = `enrichRetry_${failures}_${permanent}_${badJson}`;
    const queuePath = path.join(repoRoot, "synthetic-enrich-queue.json");
    const reads = [];
    const writes = [];
    const logs = [];
    let calls = 0;
    const response = JSON.stringify({ title: "Fixture title", summary: "Fixture summary", analysis: "Fixture analysis", tags: [], design: { relevant: false } });
    const state = {
      readFile: async (filePath) => {
        reads.push(filePath);
        if (filePath === configPath) return JSON.stringify({ queueFile: path.relative(repoRoot, queuePath), taxonomy: [] });
        assert.equal(filePath, queuePath, "only the synthetic queue can be read");
        return JSON.stringify({ items: [{ ...fixtureItems()[0], links: [], media: [] }] });
      },
      loadLocalEnv: () => {},
      resolvePiModelConfig: () => ({ provider: "fixture", model: "fixture" }),
      createAnalysisReader: () => Effect.succeed({
        prompt: () => Effect.suspend(() => {
          calls += 1;
          return calls <= failures ? Effect.fail(new Error(permanent ? "HTTP 401 unauthorized" : "HTTP 503 synthetic model failure")) : Effect.succeed(badJson ? "invalid JSON" : response);
        }),
      }),
      collectDesignEvidenceImages: () => Effect.succeed({ images: [] }),
      buildPrompt: () => "synthetic prompt",
      parseJsonResponse: JSON.parse,
      writeTextAtomically: (filePath, text) => Effect.sync(() => {
        assert.equal(filePath, queuePath);
        writes.push(JSON.parse(text));
      }),
      runCli: (program) => Effect.runPromise(Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(Effect.exit(program));
        yield* TestClock.adjust("4999 millis");
        assert.equal(calls, 1, "no retry before five seconds");
        yield* TestClock.adjust("1 millis");
        assert.equal(calls, expectedCalls);
        yield* TestClock.adjust("10 seconds");
        const exit = yield* Fiber.join(fiber);
        assert.equal(exit._tag, "Success", "CLI must handle model failures without defects");
        assert.equal(calls, expectedCalls, "no additional retry after the limit");
      }).pipe(Effect.provide(TestClock.layer()), Effect.scoped)),
      forbidden: (name) => () => assert.fail(`unexpected external adapter: ${name}`),
    };
    const originalArgs = process.argv;
    const originalExitCode = process.exitCode;
    const originalConsole = { log: console.log, warn: console.warn, error: console.error };
    const originalFetch = globalThis.fetch;
    let hooks;
    try {
      globalThis[key] = state;
      globalThis.fetch = state.forbidden("fetch");
      for (const method of Object.keys(originalConsole)) console[method] = (...values) => logs.push(values.join(" "));
      process.exitCode = 0;
      process.argv = [process.execPath, `${cliUrl.pathname}?${key}`, "--engine=codex-cli", "--concurrency=1"];
      hooks = mockCliAdapters(key, state);
      await import(`${cliUrl.href}?${key}`);
      assert.deepEqual(reads, [configPath, queuePath]);
      assert.equal(writes.length, 2, "persist the baseline and the final result");
      const item = writes[1].items[0];
      assert.equal(item.pipeline.stages.editorial.status, expectedFailure ? "error" : "complete");
      assert.equal(item.ai.title, expectedFailure ? undefined : "Fixture title");
      assert.equal(process.exitCode, expectedFailure ? 1 : 0);
      assert.ok(logs.some((line) => line.includes(expectedFailure ? "完成: 0 条解析，1 条失败" : "完成: 1 条解析，0 条失败")));
    } finally {
      hooks?.deregister();
      Object.assign(console, originalConsole);
      process.argv = originalArgs;
      process.exitCode = originalExitCode;
      globalThis.fetch = originalFetch;
      delete globalThis[key];
    }
  });
}
