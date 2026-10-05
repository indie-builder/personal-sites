#!/usr/bin/env node
import { Effect } from "effect";

import { runCommand } from "../modules/x-sync/pipeline.mjs";
import { existsSync } from "node:fs";
import path from "node:path";

import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { readJsonOr } from "./lib/json-file.mjs";
import { repoRoot } from "./lib/repo-root.mjs";
import { runCliScript } from "./lib/run-cli.mjs";

const dataRoot = path.join(repoRoot, "data/sensitive/douyin-curation");
const sidecar = path.join(dataRoot, "sidecar");
const manifest = path.join(dataRoot, "downloads/download_manifest.jsonl");

function pendingVideoCount() {
  return Effect.gen(function* () {
    return (yield* readJsonOr(path.join(dataRoot, "pending-video-urls.json"), [])).length;
  });
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

function main() {
  return Effect.gen(function* () {
    const options = parseFullSyncArgs(process.argv.slice(2));

    if (options.dryRun) {
      const pending = yield* pendingVideoCount();
      console.log(`[dry-run] 收藏索引待下载 ${pending} 条；分析阶段计划如下，不重新发现收藏页、不下载、不调用模型。`);
      const args = ["douyin:curation", "--", "sync", "--dry-run"];
      if (existsSync(manifest)) args.push("--manifest", manifest);
      yield* runCommand("pnpm", args, { cwd: repoRoot });
      return;
    }

    yield* runCommand(
      "uv",
      [
        "run",
        "python",
        path.join(repoRoot, "tools/content/scripts/douyin-favorites-discover.py"),
        "--sidecar",
        sidecar,
        "--data-root",
        dataRoot,
      ],
      { cwd: sidecar },
    );

    const pending = yield* pendingVideoCount();
    if (options.download && pending > 0) {
      console.log(`开始下载 ${pending} 条新增收藏视频。`);
      yield* runCommand("uv", ["run", "douyin-dl", "-c", "config-incremental.yml", "--show-warnings"], { cwd: sidecar });
    }

    if (options.analyze) {
      const args = ["douyin:curation", "--", "sync", "--manifest", manifest, "--engine", options.engine];
      if (options.concurrency !== null) args.push("--concurrency", String(options.concurrency));
      if (options.analyzerConcurrency !== null)
        args.push("--analyzer-concurrency", String(options.analyzerConcurrency));
      if (options.analyzeLimit !== null) args.push("--limit", String(options.analyzeLimit));
      yield* runCommand("pnpm", args, {
        cwd: repoRoot,
        env: {
          WHISPER_BIN: path.join(sidecar, ".venv/bin/whisper-ctranslate2"),
          WHISPER_COMPUTE: "int8",
          WHISPER_DEVICE: "cpu",
          WHISPER_MODEL: "small",
          OMP_NUM_THREADS: "2",
        },
      });
    }
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCliScript(main(), "抖音全量/增量同步");
}
