#!/usr/bin/env node

import { spawn } from "node:child_process";
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
    "--engine": "string",
    "--skip-analyze": "flag",
    "--skip-download": "flag",
  });
  const { discoverOnly, positionals: stages, skipAnalyze, skipDownload, ...values } = parsed;
  if (stages.length > 0) throw new Error("不接受额外参数。");
  const options = {
    analyze: true,
    analyzeLimit: null,
    analyzerConcurrency: 6,
    concurrency: 20,
    download: true,
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
      "--concurrency", String(options.concurrency),
      "--analyzer-concurrency", String(options.analyzerConcurrency),
    ];
    if (options.analyzeLimit !== null) args.push("--limit", String(options.analyzeLimit));
    await run("pnpm", args, {
      env: {
        WHISPER_BIN: path.join(sidecar, ".venv/bin/whisper-ctranslate2"),
        WHISPER_COMPUTE: "int8",
        WHISPER_DEVICE: "cpu",
        WHISPER_LANGUAGE: "zh",
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
