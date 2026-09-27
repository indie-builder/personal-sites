#!/usr/bin/env node
/** 本地 X 策展队列解析；原始队列仅留在 data/sensitive。 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAnalysisReader } from "../modules/analysis/readers.mjs";
import {
  applyCurationAnalysis,
  applyDesignAnalysis,
  hasReusableVisualFacts,
  needsCurationAnalysis,
  prepareCurationItem,
  recordCurationAnalysisFailure,
} from "../modules/x-sync/analysis.mjs";
import { designClassificationStatus } from "../modules/x-sync/design-classification.mjs";
import { collectDesignEvidenceImages } from "../modules/x-sync/design-media.mjs";
import { expandUrl, classifyUrl, fetchGithubRepo, fetchArticleText } from "../modules/x-sync/link-content.mjs";
import { buildPrompt, buildDesignPrompt, parseJsonResponse, parseDesignResponse } from "../modules/x-sync/prompts.mjs";
import { writeTextAtomically } from "./lib/atomic-file.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";
import { resolveAnalysisConcurrency, resolveAnalysisEngine, runWorkerPool } from "../modules/analysis/runtime.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);
const queuePath = path.join(repoRoot, config.queueFile);

loadLocalEnv(repoRoot);
const piModel = resolvePiModelConfig({ config, env: process.env });

const cli = parseCliOptions(process.argv.slice(2), {
  "--concurrency": "int",
  "--design-only": "flag",
  "--dry-run": "flag",
  "--engine": "string",
  "--limit": "int",
  "--model": "string",
  "--only": "csv",
  "--refresh": "flag",
  "--reasoning-effort": "string",
});
const DRY_RUN = cli.dryRun ?? false;
const DESIGN_ONLY = cli.designOnly ?? false;
const REFRESH = cli.refresh ?? false;
const ENGINE = resolveAnalysisEngine(cli.engine);
const CODEX_MODEL = cli.model ?? "gpt-5.6-luna";
const CODEX_REASONING_EFFORT = cli.reasoningEffort ?? "max";
const LIMIT = cli.limit ?? Infinity;
const CONCURRENCY = resolveAnalysisConcurrency({ engine: ENGINE, override: cli.concurrency ?? null });
const ONLY = cli.only ?? null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- AI 调用 ----------

// ---------- 主流程 ----------

const queue = JSON.parse(await readFile(queuePath, "utf8"));
queue.version = Math.max(Number(queue.version ?? 0), 3);
queue.items = queue.items.map((item) => prepareCurationItem(item));
let normalizedStatuses = 0;
for (const item of queue.items) {
  if (!item.ai?.design) continue;
  const status = designClassificationStatus(item.ai.design.relevant);
  if (item.ai.design.status === status) continue;
  item.ai.design.status = status;
  normalizedStatuses += 1;
}
if (normalizedStatuses > 0) {
  console.log(`已校正 ${normalizedStatuses} 条历史设计分类状态。`);
}
// 运行前基线落盘（紧凑 JSON），断点续跑依赖它。
await writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`);
let targets = queue.items.filter((item) => DESIGN_ONLY
  ? item.ai.enrichedAt && (
      !item.ai.design
        || (REFRESH && Number(item.pipeline?.stages?.design?.version ?? 0) < 2)
    )
  : needsCurationAnalysis(item, { refresh: REFRESH }));
if (ONLY) targets = targets.filter((item) => ONLY.has(item.id));
targets = targets.slice(0, LIMIT);

console.log(`待${DESIGN_ONLY ? "补设计分类" : "解析"}: ${targets.length} 条，并发 ${CONCURRENCY}${REFRESH ? "（强制刷新）" : ""}${DRY_RUN ? "（dry-run，不调用模型）" : ""}`);
if (!DRY_RUN && ENGINE === "pi" && !process.env.BIGMODEL_API_KEY) {
  console.error("缺少 BIGMODEL_API_KEY 环境变量，Pi 无法使用 智谱 GLM Coding 模型。");
  process.exit(1);
}
const reader = DRY_RUN ? null : await createAnalysisReader({
  engine: ENGINE,
  config: { ...config, analysis: { ...config.analysis, codex_cli: { model: CODEX_MODEL, reasoning_effort: CODEX_REASONING_EFFORT } } },
  repoRoot,
  timeoutMilliseconds: ENGINE === "pi" ? null : undefined,
});
const MODEL_LABEL = ENGINE === "codex-cli"
  ? `codex-cli/${CODEX_MODEL}`
  : ENGINE === "zcode" ? "zcode/GLM-5.3-Flash" : `pi/${piModel.provider}/${piModel.model}`;

async function callModel(prompt, images, parser = parseJsonResponse) {
  return parser(await reader.prompt(prompt, { images, imagePaths: images.map((image) => image.path) }));
}

let done = 0;
let failed = 0;
let saveQueue = Promise.resolve();

function persistQueue() {
  // stringify 放进串行链：并发完成时同一时刻最多一次全量序列化，worker 不再阻塞事件循环。
  // 紧凑 JSON（无缩进）把 9.5MB 队列的序列化与写盘成本压到最低；调试用 jq 展开即可。
  saveQueue = saveQueue.then(() => writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`));
  return saveQueue;
}

async function processItem(item) {
  const linkContents = [];
  let visualEvidence = null;
  try {
    if (!DESIGN_ONLY) {
      // 1. 展开短链
      for (const link of item.links) {
        if (link.type !== "unexpanded") continue;
        const expanded = await expandUrl(link.original);
        if (expanded) {
          link.expanded = expanded;
          link.type = classifyUrl(expanded);
        }
        await sleep(300);
      }

      // 2. 抓取链接内容
      for (const link of item.links) {
        if (link.type === "github" && link.expanded) {
          const repo = await fetchGithubRepo(link.expanded);
          linkContents.push({ ...link, repo });
        } else if ((link.type === "article" || link.type === "x-article") && link.expanded) {
          const article = await fetchArticleText(link.expanded);
          linkContents.push({ ...link, article });
        }
      }
    }

    if (DRY_RUN) {
      const expanded = item.links.filter((l) => l.expanded).length;
      const repos = linkContents.filter((l) => l.repo).length;
      const articles = linkContents.filter((l) => l.article).length;
      console.log(`[dry-run] ${item.id} @${item.author.handle}: 展开 ${expanded}/${item.links.length} 链接，仓库 ${repos}，文章 ${articles}`);
      done += 1;
      return;
    }

    // 3. AI 解析（带一次重试）
    const cachedVisualFacts = hasReusableVisualFacts(item) ? item.ai.visualFacts : null;
    // ponytail: item-level visual reuse is enough for this personal corpus; add a cross-item media hash cache only if duplicates become material.
    visualEvidence = cachedVisualFacts
      ? { cleanup: async () => {}, images: [] }
      : await collectDesignEvidenceImages(item.media);
    const prompt = DESIGN_ONLY
      ? buildDesignPrompt(item, visualEvidence.images.length, cachedVisualFacts)
      : buildPrompt(item, linkContents, visualEvidence.images.length, cachedVisualFacts, config.taxonomy);
    const parser = DESIGN_ONLY ? parseDesignResponse : parseJsonResponse;
    let parsed;
    try {
      parsed = await callModel(prompt, visualEvidence.images, parser);
    } catch (firstError) {
      console.warn(`  首次调用失败（${firstError.message.slice(0, 80)}），5 秒后重试`);
      await sleep(5000);
      parsed = await callModel(prompt, visualEvidence.images, parser);
    }

    if (DESIGN_ONLY) {
      Object.assign(item, applyDesignAnalysis(item, parsed.design, { model: MODEL_LABEL }));
    } else {
      Object.assign(item, applyCurationAnalysis(item, parsed, {
        model: MODEL_LABEL,
        visualEvidenceCount: visualEvidence.images.length,
      }));
    }

    done += 1;
    console.log(`[${done}/${targets.length}] ${item.id} → ${item.ai.title}`);
    await persistQueue(); // 每条落盘，按完成顺序串行写入
    await sleep(1000); // 限速
  } catch (error) {
    failed += 1;
    if (!DESIGN_ONLY) Object.assign(item, recordCurationAnalysisFailure(item, error, { model: MODEL_LABEL }));
    console.error(`[失败] ${item.id}: ${error.message.slice(0, 120)}`);
    await persistQueue();
    await sleep(2000);
  } finally {
    await visualEvidence?.cleanup();
  }
}

await runWorkerPool(targets.length, CONCURRENCY, (index) => processItem(targets[index]));
await saveQueue;

console.log(`\n完成: ${done} 条解析，${failed} 条失败（可重跑续传）`);
if (failed > 0) process.exitCode = 1;
