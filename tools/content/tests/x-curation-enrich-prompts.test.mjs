import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { needsCurationAnalysis, prepareCurationItem } from "../modules/x-sync/analysis.mjs";
import { enrichQueue } from "../modules/x-sync/enrich.mjs";
import { needsPromptContent as needsPromptContentForTest } from "../modules/x-sync/prompt-content.mjs";
import { content, forbidden, withQueue } from "./lib/enrich-fixtures.mjs";

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
  return [{ ...item, id: "pending", ai: {} }];
}

const promptSource = {
  fetchedAt: "2026-10-25T00:00:00.000Z",
  fullText: "Prompt of the day:\n\nYou are a reviewer. Keep answers short.",
  quoteText: null,
  replies: [{ author: { handle: "helper", name: "Helper" }, id: "2", media: [], text: "Use temperature 0.", url: "https://x.com/helper/status/2" }],
};

function promptFixture() {
  const [base] = fixtureItems();
  return prepareCurationItem({
    ...base,
    ai: { analysis: "旧解析", enrichedAt: "2026-10-01T00:00:00.000Z", summary: "旧摘要", tags: ["提示词", "软件工程提示词"], title: "旧标题" },
    id: "prompt-1",
    links: [],
    media: [],
    text: "Prompt of the day",
  });
}

test("prompts-only backfills translations and selected replies without rewriting old analysis", async () => {
  const item = promptFixture();
  await withQueue([item], async ({ queuePath, logger }) => {
    const reader = Effect.succeed({
      prompt: () => Effect.succeed(JSON.stringify({
        quoteTranslation: null,
        selectedReplies: [{ id: "2", reason: "给出了可直接复现的参数。", translation: "使用 temperature 0。" }],
        tags: ["提示词", "软件工程提示词", "代码审查"],
        translation: "每日提示词：你是一位审查者。保持回答简短。",
      })),
    });
    const result = await Effect.runPromise(enrichQueue({
      queuePath, concurrency: 1, modelLabel: "fixture", promptsOnly: true,
    }, { reader, content, promptSource: Effect.succeed({ fetch: () => Effect.succeed(promptSource) }), logger }));

    assert.deepEqual(result, { done: 1, failed: 0 });
    const saved = JSON.parse(await readFile(queuePath, "utf8")).items[0];
    assert.equal(saved.ai.title, "旧标题");
    assert.equal(saved.ai.analysis, "旧解析");
    assert.equal(saved.text, promptSource.fullText);
    assert.deepEqual(saved.ai.tags, ["提示词", "软件工程提示词", "代码审查"]);
    assert.deepEqual(saved.ai.prompt.replies.map((reply) => reply.id), ["2"]);
    assert.equal(saved.ai.prompt.replies[0].text, "Use temperature 0.");
    assert.equal(saved.pipeline.stages.prompt.status, "complete");
    assert.equal(saved.pipeline.stages.editorial.status, "complete");
  });
});

test("prompt fetch failure records a retryable error instead of publishing empty metadata", async () => {
  const item = promptFixture();
  await withQueue([item], async ({ queuePath, logger }) => {
    const reader = Effect.succeed({ prompt: () => Effect.fail(new Error("model must not be called")) });
    const result = await Effect.runPromise(enrichQueue({
      queuePath, concurrency: 1, modelLabel: "fixture", promptsOnly: true,
    }, {
      reader,
      content,
      promptSource: Effect.succeed({ fetch: () => Effect.fail(new Error("login state expired")) }),
      logger,
    }));

    assert.deepEqual(result, { done: 0, failed: 1 });
    const saved = JSON.parse(await readFile(queuePath, "utf8")).items[0];
    assert.equal(saved.ai.prompt, undefined);
    assert.equal(saved.pipeline.stages.prompt.status, "error");
    assert.match(saved.pipeline.stages.prompt.error, /login state expired/u);
    assert.equal(saved.ai.title, "旧标题");
  });
});

test("prompt model retry reuses the cached fetched replies", async () => {
  const item = promptFixture();
  await withQueue([item], async ({ queuePath, logger }) => {
    let fetches = 0;
    let calls = 0;
    const reader = Effect.succeed({
      prompt: () => Effect.gen(function* () {
        calls += 1;
        if (calls === 1) return yield* Effect.fail(new Error("HTTP 503 synthetic model failure"));
        return JSON.stringify({ quoteTranslation: null, selectedReplies: [], tags: ["提示词"], translation: "每日提示词。" });
      }),
    });
    // 重试间隔 5 秒：推进 TestClock，避免真实等待导致测试超时。
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(enrichQueue({
        queuePath, concurrency: 1, modelLabel: "fixture", promptsOnly: true,
      }, {
        reader,
        content,
        promptSource: Effect.succeed({
          fetch: () => Effect.sync(() => {
            fetches += 1;
            return promptSource;
          }),
        }),
        logger,
      }));
      while (!fiber.pollUnsafe()) {
        yield* Effect.promise(() => new Promise((resolve) => setImmediate(resolve)));
        yield* TestClock.adjust("10 seconds");
      }
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()))));

    assert.deepEqual(result, { done: 1, failed: 0 });
    assert.equal(fetches, 1);
    assert.equal(calls, 2);
    assert.equal(JSON.parse(await readFile(queuePath, "utf8")).items[0].pipeline.stages.prompt.status, "complete");
  });
});

test("a single untranslatable prompt item fails alone and keeps analysis intact", async () => {
  // 两个提示词：一个模型漏译代码 literal，另一个正常；单条失败不得中断兄弟任务。
  const broken = { ...promptFixture(), id: "prompt-broken", text: "Use the following code:\n```js\nconst a = 1;\n```" };
  const good = { ...promptFixture(), id: "prompt-good" };
  await withQueue([broken, good], async ({ queuePath, logs, logger }) => {
    const reader = Effect.succeed({
      prompt: (prompt) => Effect.succeed(JSON.stringify(prompt.includes("const a = 1;")
        ? {
            quoteTranslation: null, selectedReplies: [], tags: ["提示词"],
            translation: "这里缺少代码块。",
          }
        : {
            quoteTranslation: null, selectedReplies: [], tags: ["提示词", "软件工程提示词"],
            translation: "每日提示词：你是一位审查者。保持回答简短。",
          })),
    });
    const source = {
      ...promptSource,
      fetch: (item) => Effect.succeed({
        ...promptSource,
        fullText: item.id === "prompt-broken" ? "Use the following code:\n```js\nconst a = 1;\n```" : promptSource.fullText,
      }),
    };
    const result = await Effect.runPromise(enrichQueue({
      queuePath, concurrency: 1, modelLabel: "fixture", promptsOnly: true,
    }, { reader, content, promptSource: Effect.succeed(source), logger }));

    assert.deepEqual(result, { done: 1, failed: 1 }, logs.join("\n"));
    const items = JSON.parse(await readFile(queuePath, "utf8")).items;
    const failed = items.find((item) => item.id === "prompt-broken");
    const completed = items.find((item) => item.id === "prompt-good");
    assert.equal(failed.pipeline.stages.prompt.status, "error");
    assert.match(failed.pipeline.stages.prompt.error, /必须原样保留/u);
    assert.equal(failed.ai.analysis, "旧解析");
    assert.equal(failed.ai.prompt, undefined);
    assert.equal(completed.pipeline.stages.prompt.status, "complete");
    assert.equal(completed.ai.prompt.translation, "每日提示词：你是一位审查者。保持回答简短。");
  });
});

test("long prompts translate first so truncated JSON cannot drop replies", async () => {  const long = { ...promptFixture(), id: "prompt-long", text: `Long prompt line. ${"Details about the workflow. ".repeat(140)}` };
  await withQueue([long], async ({ queuePath, logger }) => {
    const calls = [];
    const reader = Effect.succeed({
      prompt: (prompt) => Effect.sync(() => {
        calls.push(prompt);
        return prompt.includes("生成中文译稿")
          ? JSON.stringify({ quoteTranslation: null, translation: "长提示词译文。" })
          : JSON.stringify({
              quoteTranslation: null,
              selectedReplies: [{ id: "2", reason: "补充了可直接复用的规则。", translation: "使用 temperature 0。" }],
              tags: ["提示词", "软件工程提示词"],
              translation: "这段译文不应覆盖第一步的结果。",
            });
      }),
    });
    const source = { ...promptSource, fetch: () => Effect.succeed({ ...promptSource, fullText: long.text }) };
    const result = await Effect.runPromise(enrichQueue({
      queuePath, concurrency: 1, modelLabel: "fixture", promptsOnly: true,
    }, { reader, content, promptSource: Effect.succeed(source), logger }));

    assert.deepEqual(result, { done: 1, failed: 0 });
    assert.equal(calls.length, 2);
    const saved = JSON.parse(await readFile(queuePath, "utf8")).items[0];
    assert.equal(saved.ai.prompt.translation, "长提示词译文。");
    assert.equal(saved.ai.prompt.replies.length, 1);
  });
});

test("normal enrichment continues into prompt content once the model tags an item as a prompt", async () => {
  await withQueue([{ ...fixtureItems()[0], links: [], id: "new-prompt" }], async ({ queuePath, logs, logger }) => {
    let fetches = 0;
    let calls = 0;
    const reader = Effect.succeed({
      prompt: () => Effect.sync(() => {
        calls += 1;
        if (calls === 1) {
          return JSON.stringify({
            analysis: "解析", design: { relevant: false, confidence: 0.5, reason: "非设计" },
            searchSignals: {}, summary: "摘要", tags: ["提示词", "软件工程提示词", "代码审查"],
            title: "新提示词", visualFacts: {},
          });
        }
        return JSON.stringify({
          quoteTranslation: null,
          selectedReplies: [{ id: "2", reason: "补充了可直接复用的规则。", translation: "使用 temperature 0。" }],
          tags: ["提示词", "软件工程提示词", "代码审查"],
          translation: "每日提示词。",
        });
      }),
    });
    const result = await Effect.runPromise(enrichQueue({ queuePath, concurrency: 1, modelLabel: "fixture", taxonomy: [] }, {
      reader,
      content: { ...content, collectDesignEvidenceImages: () => Effect.succeed({ images: [] }) },
      promptSource: Effect.succeed({
        fetch: () => Effect.sync(() => {
          fetches += 1;
          return promptSource;
        }),
      }),
      logger,
    }));

    assert.deepEqual(result, { done: 1, failed: 0 }, logs.join("\n"));
    assert.equal(calls, 2);
    assert.equal(fetches, 1);
    const saved = JSON.parse(await readFile(queuePath, "utf8")).items[0];
    assert.equal(saved.ai.title, "新提示词");
    assert.equal(saved.ai.prompt.replies.length, 1);
    assert.equal(saved.ai.prompt.translation, "每日提示词。");
  });
});

test("normal enrichment skips prompt backfill for previously enriched prompts", async () => {
  const item = promptFixture();
  await withQueue([item], async ({ queuePath, logger }) => {
    const result = await Effect.runPromise(enrichQueue({ queuePath, concurrency: 1, modelLabel: "fixture", taxonomy: [] }, {
      reader: Effect.succeed({ prompt: forbidden }),
      content,
      promptSource: Effect.succeed({ fetch: forbidden }),
      logger,
    }));

    // 旧提示词没有 prompt 内容时，普通同步不批量回填；回填要靠 --prompts-only。
    assert.deepEqual(result, { done: 0, failed: 0 });
    assert.ok(!needsCurationAnalysis(item));
    assert.ok(needsPromptContentForTest(item));
  });
});

test("prompts-only dry-run previews the plan without network or model", async () => {
  await withQueue([promptFixture()], async ({ queuePath, bytes, logs, logger }) => {
    const result = await Effect.runPromise(enrichQueue({
      queuePath, dryRun: true, concurrency: 1, promptsOnly: true,
    }, { reader: Effect.sync(forbidden), content, promptSource: Effect.sync(forbidden), logger }));

    assert.deepEqual(result, { done: 0, failed: 0 });
    assert.equal(await readFile(queuePath, "utf8"), bytes);
    assert.ok(logs.some((line) => line.startsWith("[dry-run] prompt-1 ") && line.includes("提示词内容")));
  });
});
