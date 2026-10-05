#!/usr/bin/env node
import { Effect } from "effect";
import { io } from "@site/effect";
/**
 * Fetch X bookmarks/likes with the local smaug installation, move only the
 * result into the ignored sensitive queue, then analyze it with the selected local model runtime.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import { parseCliOptions } from "./lib/cli.mjs";
import { repoRoot } from "./lib/repo-root.mjs";
import { runCliScript } from "./lib/run-cli.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";
import {
  DEFAULT_ANALYSIS_ENGINE,
  resolveAnalysisConcurrency,
  resolveAnalysisEngine,
} from "../modules/analysis/runtime.mjs";
import { runHistoryPipeline, runSyncPipeline } from "../modules/x-sync/pipeline.mjs";

const execFileAsync = promisify(execFile);

export function parseSyncArgs(args) {
  const { model, positionals: _positionals, ...parsed } = parseCliOptions(args.map((arg) => arg === "-h" ? "--help" : arg), {
    "--design-concurrency": "int",
    "--engine": "string",
    "--fetch-only": "flag",
    "--help": "flag",
    "--history": "flag",
    "--limit": "int",
    "--media": "flag",
    "--model": "string",
    "--no-media": "flag",
    "--reasoning-effort": "string",
    "--source": "string",
  });
  const options = {
    source: "both",
    limit: null,
    media: true,
    fetchOnly: false,
    history: false,
    engine: DEFAULT_ANALYSIS_ENGINE,
    codexModel: model ?? "gpt-5.6-luna",
    designConcurrency: null,
    reasoningEffort: "max",
    ...parsed,
  };
  if (parsed.noMedia) options.media = false;
  if (!["bookmarks", "likes", "both"].includes(options.source)) {
    throw new Error("--source 只能是 bookmarks、likes 或 both。");
  }
  options.engine = resolveAnalysisEngine(options.engine);
  if (!new Set(["none", "low", "medium", "high", "xhigh", "max"]).has(options.reasoningEffort)) {
    throw new Error("--reasoning-effort 仅支持 none、low、medium、high、xhigh 或 max。");
  }
  options.designConcurrency = resolveAnalysisConcurrency({
    codex: 40,
    engine: options.engine,
    override: options.designConcurrency,
    pi: 15,
  });
  return options;
}

function readSmaugCredentials(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const authToken = process.env.AUTH_TOKEN ?? config.twitter?.authToken ?? "";
  const ct0 = process.env.CT0 ?? config.twitter?.ct0 ?? "";
  if (!authToken || !ct0) {
    throw new Error("smaug 配置中缺少 X 登录态（auth_token 或 ct0）。");
  }
  return { authToken, ct0 };
}

function printUsage() {
  console.log(`用法：pnpm curation:sync -- [选项]

快捷入口：
  pnpm curation:sync              Pi / 智谱 GLM（默认）
  pnpm curation:sync:glm -- [选项]  显式改用 Pi Coding Agent + 智谱 GLM

选项：
  --source bookmarks|likes|both  抓取来源，默认 both
  --limit <n>                    最多交给解析器处理 n 条条目
  --engine codex-cli|pi          解析器，默认 pi / 智谱 GLM
  --model <name>                 Codex CLI 模型，默认 gpt-5.6-luna
  --reasoning-effort <level>     Codex CLI 推理等级，默认 max
  --design-concurrency <n>       缺失设计分类的回填并发；Codex 默认 40，Pi 默认 15
  --no-media                     不抓取媒体元数据（默认会抓取，供设计识别与站内播放）
  --fetch-only                   只抓取并写入策展队列，不调用模型
  --history                      全量抓取历史书签与点赞并导入策展队列
`);
}

function tweetsFromBirdResponse(raw) {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.tweets) ? parsed.tweets : [];
}

function captureSourceOrder({ birdPath, credentials, source }) {
  return io("x.source-order", async (signal) => {
    const { stdout } = await execFileAsync(birdPath, [source, "-n", "20", "--json"], {
      cwd: repoRoot,
      env: { ...process.env, AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 },
      maxBuffer: 10 * 1024 * 1024,
      signal,
    });
    const capturedAt = new Date().toISOString();
    const snapshot = {
      capturedAt,
      ids: tweetsFromBirdResponse(stdout)
        .map((tweet) => String(tweet.id))
        .filter(Boolean),
      source,
      version: 1,
    };
    const sourceOrderDir = path.join(repoRoot, "data/sensitive/x-curation/raw/source-order");
    await mkdir(sourceOrderDir, { recursive: true });
    const filename = `${source}-${capturedAt.replaceAll(/[:.]/gu, "-")}.json`;
    const outputPath = path.join(sourceOrderDir, filename);
    await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600 });
    return outputPath;
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.warn(`无法读取 X ${source} 列表顺序；新条目将暂不写入收录时间和顺序：${error.message}`);
        return null;
      }),
    ),
  );
}

function main() {
  return Effect.gen(function* () {
    const options = parseSyncArgs(process.argv.slice(2));
    if (options.help) return printUsage();

    loadLocalEnv(repoRoot);
    const smaugConfig = path.join(repoRoot, "tools/smaug/smaug.config.json");
    if (!existsSync(smaugConfig)) {
      return yield* Effect.fail(new Error("缺少 tools/smaug/smaug.config.json；请在该目录完成本机 X 登录态配置。"));
    }
    if (!process.env.BIRD_PATH && !existsSync(path.join(repoRoot, "tools/content/node_modules/.bin/bird"))) {
      return yield* Effect.fail(new Error("缺少本地 bird 依赖；请先执行 pnpm install。"));
    }
    const credentials = readSmaugCredentials(smaugConfig);

    if (options.history) {
      const curationConfig = JSON.parse(readFileSync(path.join(repoRoot, "config/x-curation.json"), "utf8"));
      yield* io("main", () => mkdir(path.join(repoRoot, curationConfig.rawDir), { recursive: true }));
      const birdPath = process.env.BIRD_PATH ?? path.join(repoRoot, "tools/content/node_modules/.bin/bird");
      console.log("开始导入全部历史 X 书签与点赞（不调用模型）。");
      yield* runHistoryPipeline({
        repoRoot,
        birdPath,
        credentials,
      });
      return;
    }

    if (!options.fetchOnly) {
      if (options.engine === "pi") {
        const model = resolvePiModelConfig({ env: process.env });
        if (!process.env.BIGMODEL_API_KEY) {
          return yield* Effect.fail(new Error("缺少 BIGMODEL_API_KEY（可写入本项目被忽略的 .env.local）。"));
        }
        console.log(`解析运行时：Pi Coding Agent / ${model.provider}/${model.model}`);
      } else {
        console.log(`解析运行时：Codex CLI / ${options.codexModel}（推理 ${options.reasoningEffort}）`);
      }
    }

    console.log(
      `开始 X 策展同步：${options.source}${options.fetchOnly ? "（仅抓取）" : "（抓取、解析并生成公开 SQLite）"}`,
    );
    const birdPath = process.env.BIRD_PATH ?? path.join(repoRoot, "tools/content/node_modules/.bin/bird");
    yield* runSyncPipeline({
      repoRoot,
      options,
      captureSourceOrder: (source) => captureSourceOrder({ birdPath, credentials, source }),
    });
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCliScript(main(), "X 策展同步");
}
