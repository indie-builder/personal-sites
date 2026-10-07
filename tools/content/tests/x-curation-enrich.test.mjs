import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { OperationError } from "@site/effect";
import { isTransientModelError, withModelRetry } from "../modules/analysis/retry.mjs";
import { TestClock } from "effect/testing";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareCurationItem } from "../modules/x-sync/analysis.mjs";
import { enrichQueue } from "../modules/x-sync/enrich.mjs";

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


const response = JSON.stringify({ title: "Fixture title", summary: "Fixture summary", analysis: "Fixture analysis", tags: ["test"], searchSignals: {}, visualFacts: {}, design: { relevant: false, confidence: 0.9, reason: "Synthetic reason" } });
const forbidden = () => assert.fail("unexpected remote call");
const content = { expandUrl: forbidden, fetchGithubRepo: forbidden, fetchArticleText: forbidden, collectDesignEvidenceImages: forbidden };

async function withQueue(items, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-enrich-"));
  const queuePath = path.join(directory, "queue.json");
  const bytes = `${JSON.stringify({ version: 1, items }, null, 2)}\n`;
  const logs = [];
  const logger = { log: (line) => logs.push(line), error: (line) => logs.push(line) };
  try {
    await writeFile(queuePath, bytes);
    await run({ queuePath, bytes, logs, logger });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const cases = [
  { name: "normal", options: {}, ids: ["pending"] },
  { name: "design-only", options: { designOnly: true }, ids: ["enriched"] },
  { name: "refresh", options: { refresh: true }, ids: ["pending", "enriched", "old-design"] },
  { name: "design refresh", options: { designOnly: true, refresh: true }, ids: ["enriched", "old-design"] },
  { name: "filtered and limited", options: { refresh: true, only: new Set(["enriched", "old-design"]), limit: 1 }, ids: ["enriched"] },
  { name: "zero targets", options: { only: new Set(["missing"]) }, ids: [] },
];
for (const normalized of [false, true]) {
  for (const scenario of cases) {
    test(`dry-run ${scenario.name} preserves ${normalized ? "normalized" : "legacy"} bytes without remote calls`, async () => {
      const items = fixtureItems().map((item) => normalized ? prepareCurationItem(item) : item);
      await withQueue(items, async ({ queuePath, bytes, logs, logger }) => {
        const result = await Effect.runPromise(enrichQueue({ queuePath, dryRun: true, concurrency: 2, ...scenario.options }, {
          reader: Effect.sync(forbidden), content, logger,
        }));
        assert.deepEqual(result, { done: 0, failed: 0 });
        assert.equal(await readFile(queuePath, "utf8"), bytes);
        const previews = logs.filter((line) => line.startsWith("[dry-run]"));
        assert.deepEqual(previews.map((line) => line.split(" ")[1]), scenario.ids);
        for (const preview of previews) {
          assert.match(preview, /现有链接类型 unexpanded、github、article，未展开 1\/3，媒体 1；计划：/u);
          assert.match(preview, scenario.options.designOnly ? /补设计分类/u : /展开 1 条短链、抓取 2 条已解析链接/u);
        }
      });
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
  test(`enrich handles ${JSON.stringify(scenario)} with bounded model retries`, async () => {
    await withQueue([{ ...fixtureItems()[0], links: [], media: [] }], async ({ queuePath, logs, logger }) => {
      let calls = 0;
      const started = Deferred.makeUnsafe();
      const reader = Effect.promise(async () => {
        const baseline = JSON.parse(await readFile(queuePath, "utf8"));
        assert.equal(baseline.version, 3, "baseline is persisted before reader acquisition");
        assert.equal(baseline.items[0].ai.title, undefined);
        return { prompt: () => Effect.gen(function* () {
          calls += 1;
          yield* Deferred.succeed(started, undefined);
          return yield* calls <= failures ? Effect.fail(new Error(permanent ? "HTTP 401 unauthorized" : "HTTP 503 synthetic model failure")) : Effect.succeed(badJson ? "invalid JSON" : response);
        }) };
      });
      const result = await Effect.runPromise(Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(enrichQueue({ queuePath, taxonomy: [], concurrency: 1, modelLabel: "fixture" }, {
          reader, content: { ...content, collectDesignEvidenceImages: () => Effect.succeed({ images: [] }) }, logger,
        }));
        yield* Deferred.await(started);
        yield* TestClock.adjust("4999 millis");
        assert.equal(calls, 1);
        yield* TestClock.adjust("1 millis");
        assert.equal(calls, expectedCalls);
        while (!fiber.pollUnsafe()) {
          yield* Effect.promise(() => new Promise((resolve) => setImmediate(resolve)));
          yield* TestClock.adjust("10 seconds");
        }
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer()), Effect.scoped));
      assert.deepEqual(result, { done: expectedFailure ? 0 : 1, failed: expectedFailure ? 1 : 0 }, logs.join("\n"));
      const item = JSON.parse(await readFile(queuePath, "utf8")).items[0];
      assert.equal(item.pipeline.stages.editorial.status, expectedFailure ? "error" : "complete");
      assert.equal(item.ai.title, expectedFailure ? undefined : "Fixture title");
      assert.equal(calls, expectedCalls);
      assert.ok(logs.some((line) => line.includes(expectedFailure ? "完成: 0 条解析，1 条失败" : "完成: 1 条解析，0 条失败")));
    });
  });
}


test("enrich bounds concurrent readers and interruption leaves only the baseline", async () => {
  const items = ["first", "second", "third"].map((id) => ({ ...fixtureItems()[0], id, links: [], media: [] }));
  await withQueue(items, async ({ queuePath, logs, logger }) => {
    let started = 0;
    let released = 0;
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const ready = yield* Deferred.make();
      const reader = Effect.succeed({ prompt: () => Effect.acquireUseRelease(
        Effect.sync(() => { started += 1; }),
        () => Effect.gen(function* () {
          if (started === 2) yield* Deferred.succeed(ready, undefined);
          yield* Effect.never;
          return response;
        }),
        () => Effect.sync(() => { released += 1; }),
      ) });
      const fiber = yield* Effect.forkChild(enrichQueue({ queuePath, taxonomy: [], concurrency: 2, modelLabel: "fixture" }, {
        reader, content: { ...content, collectDesignEvidenceImages: () => Effect.succeed({ images: [] }) }, logger,
      }));
      yield* Deferred.await(ready);
      assert.equal(started, 2, "third reader waits for an available slot");
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber);
      assert.ok(Exit.isFailure(exit));
      assert.ok(Cause.hasInterrupts(exit.cause));
    })));
    assert.equal(released, 2);
    assert.equal(started, 2);
    assert.ok(!logs.some((line) => line.includes("失败") || line.includes("完成:")));
    const queue = JSON.parse(await readFile(queuePath, "utf8"));
    assert.equal(queue.version, 3);
    assert.ok(queue.items.every((item) => !item.ai.enrichedAt && item.pipeline.stages.editorial?.status !== "error"));
  });
});

test("reader acquisition failure happens after baseline persistence", async () => {
  await withQueue([fixtureItems()[0]], async ({ queuePath, logger }) => {
    const exit = await Effect.runPromise(Effect.exit(enrichQueue({ queuePath, concurrency: 1 }, {
      reader: Effect.fail(new Error("synthetic configuration failure")), content, logger,
    })));
    assert.ok(Exit.isFailure(exit));
    const queue = JSON.parse(await readFile(queuePath, "utf8"));
    assert.equal(queue.version, 3);
    assert.ok(queue.items[0].pipeline);
  });
});
