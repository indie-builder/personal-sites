import { attempt } from "@site/effect";
import { Cause, Effect, Exit, Fiber } from "effect";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { registerCliMocks } from "./helpers/cli-mock.mjs";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import {
  buildCurationPrompt,
  curateDouyinVideo,
  parseDownloadedVideos,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toQueueItem,
} from "../modules/douyin-sync/import.mjs";
import { buildAnalyzerArgs, parseArgs, settleConcurrently } from "../scripts/douyin-curation.mjs";
import { parseFullSyncArgs } from "../scripts/douyin-full-sync.mjs";

test("Douyin manifest and analyzer output form an auditable queue item", () => {
  const [record] = parseDownloadManifest(
    `${JSON.stringify({
      author_name: "作者",
      author_sec_uid: "sec-id",
      aweme_id: "123",
      desc: "介绍一个项目",
      file_paths: ["作者/collect/demo.mp4"],
      media_type: "video",
      publish_timestamp: 1_700_000_000,
      recorded_at: "2026-08-23T10:00:00.000Z",
    })}\n`,
  );
  const video = { ...toDouyinVideo(record, "/downloads"), collectedOrder: 2 };
  const evidence = Effect.runSync(parseAnalyzerOutput({
    metadata: { title: "demo" },
    ocrResults: [{ confidence: 90, text: "Example Project", time: "0:03" }],
    timeline: [{ ocrText: "Example Project", time: "0:03", transcript: "今天介绍它" }],
    transcript: [{ text: "今天介绍它", time: "0:03" }],
    warnings: [],
  }));
  const parsed = parseCurationResponse(
    JSON.stringify({
      analysis: "**是什么**\n\n解析内容",
      excerpt: "今天介绍它",
      mentionedProjects: [
        {
          description: "视频中的项目",
          evidence: [{ channel: "ocr", text: "Example Project", time: "0:03" }],
          kind: "tool",
          name: "Example Project",
        },
      ],
      summary: "摘要",
      tags: ["AI 应用"],
      title: "值得留意的示例项目",
    }),
  );
  parsed.ai.excerpt = groundEvidenceExcerpt("Example Project", evidence).text;
  const item = toQueueItem(video, parsed, "data/sensitive/douyin-curation/raw/123/analysis.json");

  assert.equal(video.videoPath, "/downloads/作者/collect/demo.mp4");
  assert.match(buildCurationPrompt(video, evidence, ["AI 应用"]), /屏幕文字 OCR/u);
  assert.equal(item.collectedOrder, 2);
  assert.equal(item.ai.excerpt, "Example Project");
  assert.deepEqual(groundEvidenceExcerpt("Example Project", evidence), { text: "Example Project", time: "0:03" });
  assert.equal(item.mentionedProjects[0].verification, "unresolved");
  const publicItem = toPublicDouyinItem(item);
  assert.equal(publicItem.id, "douyin-123");
  assert.deepEqual(publicItem.source, {
    label: "抖音视频",
    platform: "douyin",
    url: "https://www.douyin.com/video/123",
  });
  assert.equal(publicItem.collectedOrder, 2);
});

test("Douyin importer rejects malformed or evidence-free input", () => {
  assert.throws(() => parseDownloadManifest("not-json\n"), /第 1 行/u);
  assert.throws(() => Effect.runSync(parseAnalyzerOutput({ ocrResults: [], transcript: [] })), /没有得到语音转写或屏幕文字/u);
  assert.deepEqual(parseArgs(["sync", "--manifest", "downloads/download_manifest.jsonl", "--limit", "5"]), {
    analyzerConcurrency: null,
    concurrency: null,
    dryRun: false,
    engine: "pi",
    force: false,
    limit: 5,
    manifest: "downloads/download_manifest.jsonl",
    refreshOnly: false,
    stage: "sync",
  });
  assert.equal(
    parseArgs(["sync", "--manifest", "downloads/download_manifest.jsonl", "--refresh-only"]).refreshOnly,
    true,
  );
  assert.equal(parseArgs(["sync", "--dry-run"]).manifest, null);
  assert.deepEqual(parseFullSyncArgs(["--skip-download", "--analyze-limit", "20"]), {
    analyze: true,
    analyzeLimit: 20,
    analyzerConcurrency: null,
    concurrency: null,
    download: false,
    dryRun: false,
    engine: "pi",
  });
  assert.equal(parseFullSyncArgs(["--dry-run"]).dryRun, true);
  assert.throws(() => parseArgs(["approve", "douyin:123"]), /不接受/u);
});

test("Douyin retries refresh analyzer results and key Whisper settings explicitly", () => {
  const args = buildAnalyzerArgs("video.mp4", "frames", {
    analyzer: {},
    env: { WHISPER_MODEL: "small", WHISPER_LANGUAGE: "zh" },
    forceRefresh: true,
  });
  assert.deepEqual(args.slice(-5), ["--model", "small", "--language", "zh", "--force-refresh"]);
  assert.equal(buildAnalyzerArgs("video.mp4", "frames", { analyzer: {}, env: {} }).includes("--force-refresh"), false);
});

test("Curated tags are normalized against the configured taxonomy whitelist", () => {
  const response = JSON.stringify({
    analysis: "分析",
    excerpt: "摘录",
    summary: "摘要",
    tags: ["前端", "自创标签"],
    title: "标题",
  });
  const parsed = parseCurationResponse(response, { allowedTags: ["AI 应用", "前端工程"] });
  assert.deepEqual(parsed.ai.tags, ["前端工程"]);

  assert.throws(
    () =>
      parseCurationResponse(
        JSON.stringify({ analysis: "分析", excerpt: "摘录", summary: "摘要", tags: ["乱编"], title: "标题" }),
        {
          allowedTags: ["AI 应用"],
        },
      ),
    /白名单/u,
  );
  assert.doesNotThrow(() =>
    parseCurationResponse(
      JSON.stringify({ analysis: "分析", excerpt: "摘录", summary: "摘要", tags: ["随便写的标签"], title: "标题" }),
    ),
  );
});

test("Evidence truncation declares how much of the video the model can see", () => {
  const transcript = Array.from({ length: 900 }, (_, index) => ({
    speaker: "主讲",
    text: `第${index}段内容，用于撑满证据窗口的转写句子。`,
    time: `${Math.floor(index / 60)}:${String(index % 60).padStart(2, "0")}`,
  }));
  const evidence = Effect.runSync(parseAnalyzerOutput({ metadata: {}, ocrResults: [], timeline: [], transcript, warnings: [] }));
  const prompt = buildCurationPrompt(
    { sourceUrl: "https://www.douyin.com/video/1", author: { name: "作者" }, description: "", tags: [] },
    evidence,
    ["AI 应用"],
  );
  assert.match(prompt, /仅覆盖至/u);
  assert.doesNotMatch(prompt, /第899段/u);
});

for (const scenario of [
  { name: "evidence-free", transcript: [], error: /没有得到语音转写或屏幕文字/u },
  { name: "ungroundable", transcript: [{ text: "短句" }], error: /没有可用于公开摘录/u },
  { name: "valid", transcript: [{ text: "Synthetic evidence from the video", time: "0:03" }] },
]) {
  test(`Douyin CLI settles ${scenario.name} input and persists later successes`, async () => {
    const cliUrl = new URL("../scripts/douyin-curation.mjs", import.meta.url);
    const runnerUrl = new URL("../scripts/lib/run-cli.mjs", import.meta.url);
    const repoRoot = path.resolve(path.dirname(cliUrl.pathname), "../../..");
    const key = `douyinCli_${scenario.name}`;
    const queuePath = path.join(repoRoot, "synthetic-douyin/queue.json");
    const failuresPath = path.join(repoRoot, "synthetic-douyin/analysis-failures.json");
    const manifestPath = path.join(repoRoot, "synthetic-douyin/manifest.jsonl");
    const analyzed = [];
    const prompts = [];
    const writes = [];
    const logs = [];
    let running;
    const state = {
      readFile: async (filePath) => {
        if (filePath === path.join(repoRoot, "config/douyin-curation.json")) {
          return JSON.stringify({
            queueFile: "synthetic-douyin/queue.json",
            rawDir: "synthetic-douyin/raw",
            analyzer: { package: "synthetic-analyzer", detail: "full", fields: "transcript", ocrLanguage: "eng" },
            taxonomy: ["AI 应用"],
          });
        }
        assert.equal(filePath, manifestPath, "only synthetic config and manifest may be read");
        return ["first", "later"].map((id) => JSON.stringify({
          aweme_id: id, media_type: "video", file_paths: [`${id}.mp4`],
        })).join("\n");
      },
      readJsonOr: (filePath, fallback) => {
        assert.ok([queuePath, failuresPath, path.join(repoRoot, "synthetic-douyin/favorite-index.json")].includes(filePath));
        return Effect.succeed(fallback);
      },
      loadLocalEnv: () => {},
      execFile: Object.assign(() => assert.fail("analyzer must use the promisified adapter"), {
        [promisify.custom]: async (command, args) => {
          assert.equal(command, "npx");
          const id = path.basename(args[3], ".mp4");
          analyzed.push(id);
          return { stdout: JSON.stringify({
            transcript: id === "first" ? scenario.transcript : [{ text: "Synthetic evidence from the video", time: "0:03" }],
            ocrResults: [],
          }) };
        },
      }),
      createAnalysisReader: () => Effect.succeed({
        prompt: (prompt) => Effect.sync(() => {
          prompts.push(prompt);
          return JSON.stringify({
            title: "合成标题", summary: "合成摘要", analysis: "合成分析", tags: ["AI 应用"],
            excerpt: "Synthetic evidence from the video",
          });
        }),
      }),
      writeTextAtomically: (filePath, text) => Effect.sync(() => {
        assert.equal(filePath, queuePath);
        writes.push({ filePath, value: JSON.parse(text) });
      }),
      writeJsonAtomically: (filePath, value) => Effect.sync(() => {
        assert.ok(filePath === failuresPath || /^raw\/(first|later)\/analysis\.json$/u.test(path.relative(path.dirname(queuePath), filePath)));
        writes.push({ filePath, value: structuredClone(value) });
      }),
      runCli: (program) => { running = Effect.runPromise(program); return running; },
    };
    const adapters = new Map([
      ["node:fs/promises", ["readFile"]],
      ["node:child_process", ["execFile"]],
      ["../../../scripts/lib/load-local-env.mjs", ["loadLocalEnv"]],
      ["../modules/analysis/readers.mjs", ["createAnalysisReader"]],
      ["./lib/json-file.mjs", ["readJsonOr"]],
      ["./lib/atomic-file.mjs", ["writeTextAtomically", "writeJsonAtomically"]],
      ["@site/effect/cli", ["runCli"]],
    ]);
    const originalArgs = process.argv;
    const originalExitCode = process.exitCode;
    const originalConsole = { log: console.log, error: console.error };
    let hooks;
    try {
      globalThis[key] = state;
      process.argv = [process.execPath, `${cliUrl.pathname}?${key}`, "sync", "--manifest", manifestPath, "--concurrency", "1"];
      process.exitCode = 0;
      console.log = console.error = (...values) => logs.push(values.join(" "));
      // runCli 调用收敛在 lib/run-cli.mjs；按场景加查询串隔离实例，其 runCli mock 才能逐场景生效。
      hooks = registerCliMocks({
        key,
        scheme: "douyin-test",
        matches: (parentURL, specifier) =>
          (parentURL === `${cliUrl.href}?${key}` && adapters.has(specifier)) ||
          (parentURL === `${runnerUrl.href}?${key}` && specifier === "@site/effect/cli"),
        mockExports: adapters,
        rewrite: (specifier, parentURL) =>
          parentURL === `${cliUrl.href}?${key}` && specifier === "./lib/run-cli.mjs"
            ? `${runnerUrl.href}?${key}`
            : null,
      });
      await import(`${cliUrl.href}?${key}`);
      assert.ok(running, "execute the real CLI entry point");
      await running;
      assert.deepEqual(analyzed, ["first", "later"], "a failed first item must not stop the later analyzer");
      assert.equal(prompts.length, scenario.name === "evidence-free" ? 2 : 3, "no model call for evidence-free input");
      const queueWrites = writes.filter((write) => write.filePath === queuePath);
      assert.deepEqual(queueWrites.at(-1).value.items.map((item) => item.id), scenario.error ? ["douyin:later"] : ["douyin:first", "douyin:later"]);
      if (scenario.error) {
        assert.ok(queueWrites.every((write) => write.value.items.every((item) => item.id !== "douyin:first")), "invalid items never enter the publishable queue");
      }
      const failures = writes.find((write) => write.filePath === failuresPath).value.items;
      assert.equal(failures.length, scenario.error ? 1 : 0);
      if (scenario.error) {
        assert.equal(failures[0].id, "douyin:first");
        assert.match(failures[0].error, scenario.error);
      }
      assert.equal(process.exitCode, scenario.error ? 1 : 0);
      assert.ok(logs.some((line) => line.includes(scenario.error ? "成功 1 条，失败 1 条" : "成功 2 条，失败 0 条")));
    } finally {
      hooks?.deregister();
      Object.assign(console, originalConsole);
      process.argv = originalArgs;
      process.exitCode = originalExitCode;
      delete globalThis[key];
    }
  });
}

test("Douyin business boundaries expose malformed input as typed failures", async () => {
  for (const input of ["not-json", JSON.stringify({ media_type: "video" }), JSON.stringify({ aweme_id: "1", media_type: "video", file_paths: [] })]) {
    const recovered = await Effect.runPromise(parseDownloadedVideos(input, "/synthetic").pipe(
      Effect.catchTag("OperationError", (error) => Effect.succeed(error.operation)),
    ));
    assert.equal(recovered, "douyin.manifest");
  }
  const parsed = await Effect.runPromise(parseDownloadedVideos(JSON.stringify({ aweme_id: "1", media_type: "video", file_paths: ["a.mp4"] }), "/synthetic"));
  assert.equal(parsed[0].videoPath, "/synthetic/a.mp4");
});

for (const scenario of ["valid", "syntax-repair", "invalid-repair", "semantic", "ungroundable"]) {
  test(`Douyin curation business interface handles ${scenario} without CLI hooks`, async () => {
    const evidence = await Effect.runPromise(parseAnalyzerOutput({ transcript: [{ text: scenario === "ungroundable" ? "短句" : "Synthetic evidence from the video", time: "0:03" }] }));
    const video = toDouyinVideo({ aweme_id: "1", media_type: "video", file_paths: ["a.mp4"] }, "/synthetic");
    let calls = 0;
    const reader = { prompt: () => Effect.sync(() => {
      calls += 1;
      if (scenario === "invalid-repair" || (scenario === "syntax-repair" && calls === 1)) return "invalid JSON";
      return JSON.stringify({ title: "标题", summary: "摘要", analysis: "分析", excerpt: "Synthetic evidence from the video", tags: scenario === "semantic" ? [] : ["AI 应用"] });
    }) };
    const result = await Effect.runPromise(curateDouyinVideo(reader, video, evidence, {
      taxonomy: ["AI 应用"], rawEvidencePath: "synthetic/analysis.json",
    }).pipe(Effect.match({ onFailure: (error) => ({ error }), onSuccess: (item) => ({ item }) })));
    assert.equal(calls, ["syntax-repair", "invalid-repair"].includes(scenario) ? 2 : 1);
    if (["semantic", "ungroundable", "invalid-repair"].includes(scenario)) assert.equal(result.error._tag, "OperationError");
    else {
      assert.equal(result.item.id, "douyin:1");
      assert.equal(result.item.ai.excerptTime, "0:03");
      assert.equal(result.item.privateEvidencePath, "synthetic/analysis.json");
    }
  });
}

test("Douyin settlement propagates defects and interruption and runs finalizers", async () => {
  const defect = new Error("programmer defect");
  const defectExit = await Effect.runPromiseExit(settleConcurrently([1], 1, () => Effect.die(defect)));
  assert.ok(Exit.isFailure(defectExit));
  assert.equal(Cause.squash(defectExit.cause), defect);
  let finalized = false;
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(settleConcurrently([1], 1, () => Effect.never.pipe(
      Effect.ensuring(Effect.sync(() => { finalized = true; })),
    )));
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    assert.ok(Exit.isFailure(exit));
    assert.ok(Cause.hasInterrupts(exit.cause));
  })));
  assert.equal(finalized, true);
});

test("Douyin worker pool records one failure without stopping later work", async () => {
  const completed = [];
  const failures = await Effect.runPromise(
    settleConcurrently([1, 2, 3], 2, (value) =>
      attempt("fixture", () => {
        if (value === 2) throw new Error("broken");
        completed.push(value);
      }),
    ),
  );

  assert.deepEqual(completed.sort(), [1, 3]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].target, 2);
  assert.match(failures[0].error.message, /broken/u);
});
