#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCodexCliReader, createBigModelReader, createZcodeCliReader } from "../modules/github-starred/analysis.mjs";
import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine, runWorkerPool } from "../modules/analysis/runtime.mjs";
import {
  buildCurationPrompt,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toQueueItem,
} from "../modules/douyin-sync/import.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
    throw new Error("用法：pnpm douyin:curation -- sync --manifest <download_manifest.jsonl> [--dry-run] [--refresh-only] [--limit n] [--engine zcode|codex-cli|pi]");
  }
  if (!options.manifest && !(options.dryRun || options.refreshOnly)) {
    throw new Error("sync 需要 --manifest <download_manifest.jsonl>。");
  }
  options.engine = resolveAnalysisEngine(options.engine);
  return options;
}

async function readQueue() {
  try {
    return JSON.parse(await readFile(queuePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { items: [], version: 1 };
    throw error;
  }
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

async function readFavoriteOrders() {
  const index = await readFile(favoriteIndexPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { items: [] };
    throw error;
  });
  return new Map(index.items.map((item, order) => [`douyin:${item.id}`, order]));
}

export async function settleConcurrently(targets, concurrency, processTarget) {
  const failures = [];
  await runWorkerPool(targets.length, concurrency, async (index) => {
    try {
      await processTarget(targets[index]);
    } catch (error) {
      failures.push({ error, target: targets[index] });
    }
  });
  return failures;
}

async function analyzeVideo(video) {
  const outputDirectory = path.join(rawRoot, video.awemeId, "frames");
  const { stdout } = await execFileAsync(
    "npx",
    [
      "-y",
      config.analyzer.package,
      "analyze",
      video.videoPath,
      "--detail",
      config.analyzer.detail,
      "--fields",
      config.analyzer.fields,
      "--ocr-language",
      config.analyzer.ocrLanguage,
      "--out",
      outputDirectory,
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, MCP_WRITE_SIDECARS: "1" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return parseAnalyzerOutput(stdout);
}

/**
 * 调用模型并解析策展 JSON。语法级解析失败时做一次「修复为 JSON」的廉价重试，
 * 避免整条视频重新转写分析；字段缺失等语义错误仍直接失败进失败清单。
 */
async function promptCurationResponse(reader, prompt, taxonomy) {
  const parse = (raw) => parseCurationResponse(raw, { allowedTags: taxonomy });
  const raw = await reader.prompt(prompt);
  try {
    return parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const repaired = await reader.prompt([
      "你上一次的输出无法解析为 JSON：",
      error.message,
      "请把它修复为合法 JSON；只输出 JSON 本身，不要解释、不要代码围栏。原始输出：",
      raw.slice(0, 8_000),
    ].join("\n"));
    return parse(repaired);
  }
}

async function sync(options) {
  loadLocalEnv(repoRoot);
  const manifestPath = options.manifest ? path.resolve(repoRoot, options.manifest) : null;
  const records = manifestPath ? parseDownloadManifest(await readFile(manifestPath, "utf8")) : [];
  const favoriteOrders = await readFavoriteOrders();
  const videos = records
    .map((record) => toDouyinVideo(record, manifestPath ? path.dirname(manifestPath) : repoRoot))
    .filter(Boolean)
    .map((video) => ({ ...video, collectedOrder: favoriteOrders.get(`douyin:${video.awemeId}`) ?? null }))
    // 收藏顺序小的更新（收藏页最新在前），--limit 只截最新收藏。
    .sort((left, right) => (left.collectedOrder ?? Number.MAX_SAFE_INTEGER) - (right.collectedOrder ?? Number.MAX_SAFE_INTEGER))
    .slice(0, options.limit);
  const queue = await readQueue();
  const byId = new Map(queue.items.map((item) => [item.id, item]));
  for (const item of byId.values()) {
    item.collectedOrder = favoriteOrders.get(item.id) ?? item.collectedOrder ?? null;
  }
  const previousFailures = await readFile(failuresPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { items: [] };
    throw error;
  });
  const failuresById = new Map(previousFailures.items.map((item) => [item.id, item]));

  if (options.dryRun) {
    console.log(`[dry-run] 条目队列 ${queue.items.length} 条，历史失败 ${previousFailures.items.length} 条；不读取视频、不调用模型、不落盘。`);
    if (manifestPath) {
      const knownIds = new Set(byId.keys());
      const pending = videos.filter((video) => !knownIds.has(`douyin:${video.awemeId}`));
      console.log(`[dry-run] 清单 ${videos.length} 条，待分析 ${pending.length} 条${Number.isFinite(options.limit) ? `（--limit 取最新 ${Math.min(options.limit, pending.length)} 条）` : ""}。`);
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
  const reader = options.refreshOnly ? null
    : options.engine === "pi"
      ? await createBigModelReader({ config: {}, repoRoot })
      : options.engine === "zcode"
        ? createZcodeCliReader({ config: {}, repoRoot })
        : await createCodexCliReader({
          config: { analysis: { codex_cli: { model: "gpt-5.6-terra", reasoning_effort: "high" } } },
          repoRoot,
        });

  const targets = options.refreshOnly ? [] : videos.filter((video) => options.force || !byId.has(`douyin:${video.awemeId}`));

  if (reader && targets.length > 0) {
    try {
      await reader.prompt("连通性探活：只回复 OK。");
    } catch (error) {
      throw new Error(`分析引擎探活失败，请检查 CLI 登录态与模型端点配置，或用 --engine 切换引擎：${error.message}`);
    }
  }

  let completed = 0;
  let saveQueue = Promise.resolve();
  function persistQueue() {
    queue.items = [...byId.values()];
    queue.updatedAt = new Date().toISOString();
    // stringify 放进串行链，紧凑 JSON：并发完成时同一时刻最多一次全量序列化。
    saveQueue = saveQueue.then(async () => {
      await mkdir(path.dirname(queuePath), { mode: 0o700, recursive: true });
      await writeFile(queuePath, `${JSON.stringify(queue)}\n`, { mode: 0o600 });
    });
    return saveQueue;
  }
  await persistQueue();
  let activeAnalyzers = 0;
  const analyzerWaiters = [];

  async function withAnalyzerSlot(callback) {
    // 唤醒后必须重新检查：槽位可能已被新到达的调用抢占，否则会瞬时超并发。
    while (activeAnalyzers >= analyzerConcurrency) {
      await new Promise((resolve) => analyzerWaiters.push(resolve));
    }
    activeAnalyzers += 1;
    try {
      return await callback();
    } finally {
      activeAnalyzers -= 1;
      analyzerWaiters.shift()?.();
    }
  }

  async function processVideo(video) {
    const id = `douyin:${video.awemeId}`;
    const evidence = await withAnalyzerSlot(() => analyzeVideo(video));
    const rawEvidencePath = path.join(rawRoot, video.awemeId, "analysis.json");
    await writePrivateJson(rawEvidencePath, { evidence, source: video });
    const parsed = await promptCurationResponse(reader, buildCurationPrompt(video, evidence, config.taxonomy), config.taxonomy);
    const grounded = groundEvidenceExcerpt(parsed.ai.excerpt, evidence);
    parsed.ai.excerpt = grounded.text;
    parsed.ai.excerptTime = grounded.time;
    const item = toQueueItem(video, parsed, path.relative(repoRoot, rawEvidencePath));
    byId.set(id, item);
    failuresById.delete(id);
    await persistQueue();
    completed += 1;
    console.log(`[${completed}/${targets.length}] ${id} 已入队。`);
  }

  const failures = await settleConcurrently(targets, concurrency, processVideo);
  await saveQueue;
  for (const { error, target } of failures) {
    failuresById.set(`douyin:${target.awemeId}`, {
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
      id: `douyin:${target.awemeId}`,
    });
  }
  await writePrivateJson(failuresPath, { items: [...failuresById.values()], updatedAt: new Date().toISOString(), version: 1 });
  console.log(`抖音关注同步完成：成功 ${completed} 条，失败 ${failures.length} 条；队列条目将随下一次 pnpm curation:publish 发布。`);
  const grouped = new Map();
  for (const { error } of failures) {
    const message = (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 120);
    grouped.set(message, (grouped.get(message) ?? 0) + 1);
  }
  for (const [message, count] of [...grouped.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)) {
    console.log(`  失败 ${count} 条：${message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await sync(options);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`抖音关注处理失败：${error.message}`);
    process.exitCode = 1;
  });
}
