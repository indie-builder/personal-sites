#!/usr/bin/env node
import { runCli } from "@site/effect/cli";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createAnalysisReader } from "../modules/analysis/readers.mjs";
import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import {
  buildCurationPrompt,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toQueueItem,
} from "../modules/douyin-sync/import.mjs";
import { writeJsonAtomically, writeTextAtomically } from "./lib/atomic-file.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { readJsonOr } from "./lib/json-file.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/douyin-curation.json"), "utf8"));
const queuePath = path.join(repoRoot, config.queueFile);
const rawRoot = path.join(repoRoot, config.rawDir);
const failuresPath = path.join(path.dirname(queuePath), "analysis-failures.json");
const favoriteIndexPath = path.join(path.dirname(queuePath), "favorite-index.json");

export function parseArgs(args) {
  const parsed = parseCliOptions(args, {
    "--analyzer-concurrency": "int",
    "--concurrency": "int",
    "--dry-run": "flag",
    "--engine": "string",
    "--force": "flag",
    "--limit": "int",
    "--manifest": "string",
    "--refresh-only": "flag",
  });
  const [stage = null, ...extra] = parsed.positionals;
  const options = {
    analyzerConcurrency: null,
    concurrency: null,
    dryRun: false,
    engine: DEFAULT_ANALYSIS_ENGINE,
    force: false,
    limit: Infinity,
    manifest: null,
    refreshOnly: false,
    ...parsed,
    stage,
  };
  delete options.positionals;
  if (extra.length > 0) throw new Error("sync 不接受额外参数。");
  if (options.stage !== "sync") {
    throw new Error(
      "用法：pnpm douyin:curation -- sync --manifest <download_manifest.jsonl> [--dry-run] [--refresh-only] [--limit n] [--engine zcode|codex-cli|pi]",
    );
  }
  if (!options.manifest && !(options.dryRun || options.refreshOnly)) {
    throw new Error("sync 需要 --manifest <download_manifest.jsonl>。");
  }
  options.engine = resolveAnalysisEngine(options.engine);
  return options;
}

function readFavoriteOrders() {
  return Effect.gen(function* () {
    const index = yield* readJsonOr(favoriteIndexPath, { items: [] });
    return new Map(index.items.map((item, order) => [`douyin:${item.id}`, order]));
  });
}

export function settleConcurrently(targets, concurrency, processTarget) {
  return Effect.gen(function* () {
    const failures = [];
    yield* Effect.forEach(
      targets,
      (target) =>
        Effect.suspend(() => processTarget(target)).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              failures.push({ error, target });
            }),
          ),
        ),
      { concurrency, discard: true },
    );
    return failures;
  });
}

export function buildAnalyzerArgs(videoPath, outputDirectory, { forceRefresh = false, env = process.env } = {}) {
  const args = [
    "-y",
    config.analyzer.package,
    "analyze",
    videoPath,
    "--detail",
    config.analyzer.detail,
    "--fields",
    config.analyzer.fields,
    "--ocr-language",
    config.analyzer.ocrLanguage,
    "--out",
    outputDirectory,
  ];
  if (env.WHISPER_MODEL) args.push("--model", env.WHISPER_MODEL);
  if (env.WHISPER_LANGUAGE) args.push("--language", env.WHISPER_LANGUAGE);
  if (forceRefresh) args.push("--force-refresh");
  return args;
}

function analyzeVideo(video, forceRefresh = false) {
  return Effect.gen(function* () {
    const outputDirectory = path.join(rawRoot, video.awemeId, "frames");
    const { stdout } = yield* io("analyzeVideo", (signal) =>
      execFileAsync("npx", buildAnalyzerArgs(video.videoPath, outputDirectory, { forceRefresh }), {
        cwd: repoRoot,
        env: { ...process.env, MCP_WRITE_SIDECARS: "1" },
        maxBuffer: 64 * 1024 * 1024,
        signal,
      }),
    );
    return parseAnalyzerOutput(stdout);
  });
}

/**
 * 调用模型并解析策展 JSON。语法级解析失败时做一次「修复为 JSON」的廉价重试，
 * 避免整条视频重新转写分析；字段缺失等语义错误仍直接失败进失败清单。
 */
function promptCurationResponse(reader, prompt, taxonomy) {
  const parse = (raw) => attempt("douyin.parse", () => parseCurationResponse(raw, { allowedTags: taxonomy }));
  return reader
    .prompt(prompt)
    .pipe(
      Effect.flatMap((raw) =>
        parse(raw).pipe(
          Effect.catchAll((error) =>
            error.cause instanceof SyntaxError
              ? reader
                  .prompt(
                    [
                      "你上一次的输出无法解析为 JSON：",
                      error.message,
                      "请把它修复为合法 JSON；只输出 JSON 本身，不要解释、不要代码围栏。原始输出：",
                      raw.slice(0, 8_000),
                    ].join("\n"),
                  )
                  .pipe(Effect.flatMap(parse))
              : Effect.fail(error),
          ),
        ),
      ),
    );
}

function sync(options) {
  return Effect.gen(function* () {
    loadLocalEnv(repoRoot);
    const manifestPath = options.manifest ? path.resolve(repoRoot, options.manifest) : null;
    const records = manifestPath ? parseDownloadManifest(yield* io("sync", () => readFile(manifestPath, "utf8"))) : [];
    const favoriteOrders = yield* readFavoriteOrders();
    const videos = records
      .map((record) => toDouyinVideo(record, manifestPath ? path.dirname(manifestPath) : repoRoot))
      .filter(Boolean)
      .map((video) => ({ ...video, collectedOrder: favoriteOrders.get(`douyin:${video.awemeId}`) ?? null }))
      // 收藏顺序小的更新（收藏页最新在前），--limit 只截最新收藏。
      .sort(
        (left, right) =>
          (left.collectedOrder ?? Number.MAX_SAFE_INTEGER) - (right.collectedOrder ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, options.limit);
    const queue = yield* readJsonOr(queuePath, { items: [], version: 1 });
    const byId = new Map(queue.items.map((item) => [item.id, item]));
    for (const item of byId.values()) {
      item.collectedOrder = favoriteOrders.get(item.id) ?? item.collectedOrder ?? null;
    }
    const previousFailures = yield* readJsonOr(failuresPath, { items: [] });
    const failuresById = new Map(previousFailures.items.map((item) => [item.id, item]));

    if (options.dryRun) {
      console.log(
        `[dry-run] 条目队列 ${queue.items.length} 条，历史失败 ${previousFailures.items.length} 条；不读取视频、不调用模型、不落盘。`,
      );
      if (manifestPath) {
        const knownIds = new Set(byId.keys());
        const pending = videos.filter((video) => !knownIds.has(`douyin:${video.awemeId}`));
        console.log(
          `[dry-run] 清单 ${videos.length} 条，待分析 ${pending.length} 条${Number.isFinite(options.limit) ? `（--limit 取最新 ${Math.min(options.limit, pending.length)} 条）` : ""}。`,
        );
        for (const video of pending.slice(0, 10)) {
          console.log(`  douyin:${video.awemeId} 收藏顺序 ${video.collectedOrder ?? "未知"}`);
        }
        if (pending.length > 10) console.log(`  …其余 ${pending.length - 10} 条省略。`);
      } else {
        console.log("[dry-run] 未提供 --manifest，跳过待分析清单统计。");
      }
      return;
    }

    const concurrency = options.concurrency ?? (options.engine === "pi" ? 2 : options.engine === "zcode" ? 8 : 20);
    const analyzerConcurrency = options.analyzerConcurrency ?? 6;
    const reader = options.refreshOnly
      ? null
      : yield* createAnalysisReader({
          engine: options.engine,
          config: { analysis: { codex_cli: { model: "gpt-5.6-terra", reasoning_effort: "high" } } },
          repoRoot,
        });

    const targets = options.refreshOnly
      ? []
      : videos.filter((video) => options.force || !byId.has(`douyin:${video.awemeId}`));

    if (reader && targets.length > 0) {
      yield* reader
        .prompt("连通性探活：只回复 OK。")
        .pipe(
          Effect.mapError(
            (error) =>
              new Error(`分析引擎探活失败，请检查 CLI 登录态与模型端点配置，或用 --engine 切换引擎：${error.message}`),
          ),
        );
    }

    let completed = 0;
    const saveLock = Effect.unsafeMakeSemaphore(1);
    const analyzerLock = Effect.unsafeMakeSemaphore(analyzerConcurrency);
    function persistQueue() {
      return saveLock.withPermits(1)(
        Effect.suspend(() => {
          queue.items = [...byId.values()];
          queue.updatedAt = new Date().toISOString();
          return writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`);
        }),
      );
    }
    yield* persistQueue();

    function processVideo(video) {
      return Effect.gen(function* () {
        const id = `douyin:${video.awemeId}`;
        const evidence = yield* analyzerLock.withPermits(1)(analyzeVideo(video, options.force || failuresById.has(id)));
        const rawEvidencePath = path.join(rawRoot, video.awemeId, "analysis.json");
        yield* writeJsonAtomically(rawEvidencePath, { evidence, source: video });
        const parsed = yield* promptCurationResponse(
          reader,
          buildCurationPrompt(video, evidence, config.taxonomy),
          config.taxonomy,
        );
        const grounded = groundEvidenceExcerpt(parsed.ai.excerpt, evidence);
        parsed.ai.excerpt = grounded.text;
        parsed.ai.excerptTime = grounded.time;
        const item = toQueueItem(video, parsed, path.relative(repoRoot, rawEvidencePath));
        byId.set(id, item);
        failuresById.delete(id);
        yield* persistQueue();
        completed += 1;
        console.log(`[${completed}/${targets.length}] ${id} 已入队。`);
      });
    }

    const failures = yield* settleConcurrently(targets, concurrency, processVideo);
    for (const { error, target } of failures) {
      failuresById.set(`douyin:${target.awemeId}`, {
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
        id: `douyin:${target.awemeId}`,
      });
    }
    yield* writeJsonAtomically(failuresPath, {
      items: [...failuresById.values()],
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    console.log(
      `抖音关注同步完成：成功 ${completed} 条，失败 ${failures.length} 条；队列条目将随下一次 pnpm curation:publish 发布。`,
    );
    const grouped = new Map();
    for (const { error } of failures) {
      const message = (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 120);
      grouped.set(message, (grouped.get(message) ?? 0) + 1);
    }
    for (const [message, count] of [...grouped.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)) {
      console.log(`  失败 ${count} 条：${message}`);
    }
  });
}

function main() {
  return Effect.gen(function* () {
    const options = parseArgs(process.argv.slice(2));
    yield* sync(options);
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(main()).catch((error) => {
    console.error(`抖音关注处理失败：${error.message}`);
    process.exitCode = 1;
  });
}
