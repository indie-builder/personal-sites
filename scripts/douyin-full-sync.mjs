#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import { parseCliOptions } from "./lib/cli.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(repoRoot, "data/sensitive/douyin-curation");
const sidecar = path.join(dataRoot, "sidecar");
const manifest = path.join(dataRoot, "downloads/download_manifest.jsonl");

function run(command, args, { cwd = repoRoot, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`));
    });
  });
}

async function pendingVideoCount() {
  try {
    return JSON.parse(await readFile(path.join(dataRoot, "pending-video-urls.json"), "utf8")).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export function parseFullSyncArgs(args) {
  const parsed = parseCliOptions(args, {
    "--analyzer-concurrency": "int",
    "--analyze-limit": "int",
    "--concurrency": "int",
    "--discover-only": "flag",
    "--dry-run": "flag",
    "--engine": "string",
    "--skip-analyze": "flag",
    "--skip-download": "flag",
  });
  const { discoverOnly, positionals: stages, skipAnalyze, skipDownload, ...values } = parsed;
  if (stages.length > 0) throw new Error("不接受额外参数。");
  const options = {
    analyze: true,
    analyzeLimit: null,
    // 并发默认值以 douyin:curation 的引擎感知配置为唯一来源，这里只在显式传入时覆盖。
    analyzerConcurrency: null,
    concurrency: null,
    download: true,
    dryRun: false,
    engine: DEFAULT_ANALYSIS_ENGINE,
    ...values,
  };
  if (discoverOnly) {
    options.download = false;
    options.analyze = false;
  }
  if (skipDownload) options.download = false;
  if (skipAnalyze) options.analyze = false;
  options.engine = resolveAnalysisEngine(options.engine);
  return options;
}

async function main() {
  const options = parseFullSyncArgs(process.argv.slice(2));

  if (options.dryRun) {
    const pending = await pendingVideoCount();
    console.log(`[dry-run] 收藏索引待下载 ${pending} 条；分析阶段计划如下，不重新发现收藏页、不下载、不调用模型。`);
    const args = ["douyin:curation", "--", "sync", "--dry-run"];
    if (existsSync(manifest)) args.push("--manifest", manifest);
    await run("pnpm", args);
    return;
  }

  await run("uv", [
    "run",
    "python",
    path.join(repoRoot, "scripts/douyin-favorites-discover.py"),
    "--sidecar",
    sidecar,
    "--data-root",
    dataRoot,
  ], { cwd: sidecar });

  const pending = await pendingVideoCount();
  if (options.download && pending > 0) {
    console.log(`开始下载 ${pending} 条新增收藏视频。`);
    await run("uv", ["run", "douyin-dl", "-c", "config-incremental.yml", "--show-warnings"], { cwd: sidecar });
  }

  if (options.analyze) {
    const args = [
      "douyin:curation", "--", "sync", "--manifest", manifest,
      "--engine", options.engine,
    ];
    if (options.concurrency !== null) args.push("--concurrency", String(options.concurrency));
    if (options.analyzerConcurrency !== null) args.push("--analyzer-concurrency", String(options.analyzerConcurrency));
    if (options.analyzeLimit !== null) args.push("--limit", String(options.analyzeLimit));
    await run("pnpm", args, {
      env: {
        WHISPER_BIN: path.join(sidecar, ".venv/bin/whisper-ctranslate2"),
        WHISPER_COMPUTE: "int8",
        WHISPER_DEVICE: "cpu",
        WHISPER_MODEL: "small",
        OMP_NUM_THREADS: "2",
      },
    });
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`抖音全量/增量同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
