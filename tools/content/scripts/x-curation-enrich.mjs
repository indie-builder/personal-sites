#!/usr/bin/env node
import { runCli } from "@site/effect/cli";
import { Effect, Semaphore } from "effect";
import { attempt, io, OperationError } from "@site/effect";
import { withModelRetry } from "../modules/analysis/retry.mjs";
/** 本地 X 策展队列解析；原始队列仅留在 data/sensitive。 */

import { readFile } from "node:fs/promises";
import path from "node:path";

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
import { resolveAnalysisConcurrency, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { repoRoot } from "./lib/repo-root.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

export function main(args = process.argv.slice(2)) {
  return Effect.gen(function* () {
    const config = yield* io("curation.config", async () => JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8")));
    const queuePath = path.join(repoRoot, config.queueFile);
    yield* attempt("curation.env", () => loadLocalEnv(repoRoot));
    const piModel = yield* attempt("curation.model", () => resolvePiModelConfig({ config, env: process.env }));
    const cli = yield* attempt("curation.options", () => parseCliOptions(args, {
      "--concurrency": "int",
      "--design-only": "flag",
      "--dry-run": "flag",
      "--engine": "string",
      "--limit": "int",
      "--model": "string",
      "--only": "csv",
      "--refresh": "flag",
      "--reasoning-effort": "string",
    }));
    const DRY_RUN = cli.dryRun ?? false;
    const DESIGN_ONLY = cli.designOnly ?? false;
    const REFRESH = cli.refresh ?? false;
    const ENGINE = yield* attempt("curation.engine", () => resolveAnalysisEngine(cli.engine));
    const CODEX_MODEL = cli.model ?? "gpt-5.6-luna";
    const CODEX_REASONING_EFFORT = cli.reasoningEffort ?? "max";
    const LIMIT = cli.limit ?? Infinity;
    const CONCURRENCY = yield* attempt("curation.concurrency", () => resolveAnalysisConcurrency({ engine: ENGINE, override: cli.concurrency ?? null }));
    const ONLY = cli.only ?? null;

    const queue = yield* io("curation.queue", async () => JSON.parse(await readFile(queuePath, "utf8")));
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
      console.log(`${DRY_RUN ? "预览校正" : "已校正"} ${normalizedStatuses} 条历史设计分类状态。`);
    }
    let targets = queue.items.filter((item) =>
      DESIGN_ONLY
        ? item.ai.enrichedAt && (!item.ai.design || (REFRESH && Number(item.pipeline?.stages?.design?.version ?? 0) < 2))
        : needsCurationAnalysis(item, { refresh: REFRESH }),
    );
    if (ONLY) targets = targets.filter((item) => ONLY.has(item.id));
    targets = targets.slice(0, LIMIT);

    console.log(
      `待${DESIGN_ONLY ? "补设计分类" : "解析"}: ${targets.length} 条，并发 ${CONCURRENCY}${REFRESH ? "（强制刷新）" : ""}${DRY_RUN ? "（dry-run，仅预览计划）" : ""}`,
    );
    if (DRY_RUN) {
      for (const item of targets) {
        const links = item.links ?? [];
        const linkTypes = [...new Set(links.map((link) => link.type ?? "external"))].join("、") || "无";
        const unresolved = links.filter((link) => link.type === "unexpanded").length;
        const fetchable = links.filter((link) =>
          link.expanded && ["github", "article", "x-article"].includes(link.type),
        ).length;
        const visualWork = hasReusableVisualFacts(item) ? "复用视觉事实" : "收集媒体证据";
        console.log(
          `[dry-run] ${item.id} @${item.author.handle}: 现有链接类型 ${linkTypes}，未展开 ${unresolved}/${links.length}，媒体 ${item.media?.length ?? 0}；计划：${DESIGN_ONLY ? "补设计分类" : `展开 ${unresolved} 条短链、抓取 ${fetchable} 条已解析链接及展开后支持的链接、完整解析`}，${visualWork}`,
        );
      }
      return;
    }
    // 运行前基线落盘（紧凑 JSON），断点续跑依赖它。
    yield* writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`);
    if (ENGINE === "pi" && !process.env.BIGMODEL_API_KEY) {
      return yield* Effect.fail(new OperationError("curation.config", new Error("缺少 BIGMODEL_API_KEY 环境变量，Pi 无法使用 智谱 GLM Coding 模型。")));
    }
    const reader = yield* createAnalysisReader({
      engine: ENGINE,
      config: {
        ...config,
        analysis: { ...config.analysis, codex_cli: { model: CODEX_MODEL, reasoning_effort: CODEX_REASONING_EFFORT } },
      },
      repoRoot,
      timeoutMilliseconds: ENGINE === "pi" ? null : undefined,
    });
    const MODEL_LABEL =
      ENGINE === "codex-cli"
        ? `codex-cli/${CODEX_MODEL}`
        : ENGINE === "zcode"
          ? "zcode/GLM-5.3-Flash"
          : `pi/${piModel.provider}/${piModel.model}`;

    function callModel(prompt, images, parser = parseJsonResponse) {
      return reader
        .prompt(prompt, { images, imagePaths: images.map((image) => image.path) })
        .pipe(withModelRetry, Effect.flatMap((text) => attempt("curation.parse", () => parser(text))));
    }

    let done = 0;
    let failed = 0;
    const saveLock = Semaphore.makeUnsafe(1);
    function persistQueue() {
      // Serialize only after acquiring the permit so concurrent completions cannot save stale snapshots.
      return saveLock.withPermits(1)(Effect.suspend(() => writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`)));
    }

    function processItem(item) {
      return Effect.scoped(
        Effect.gen(function* () {
          const linkContents = [];

          if (!DESIGN_ONLY) {
            // 1. 展开短链
            for (const link of item.links) {
              if (link.type !== "unexpanded") continue;
              const expanded = yield* expandUrl(link.original);
              if (expanded) {
                link.expanded = expanded;
                link.type = classifyUrl(expanded);
              }
              yield* Effect.sleep(300);
            }

            // 2. 抓取链接内容
            for (const link of item.links) {
              if (link.type === "github" && link.expanded) {
                const repo = yield* fetchGithubRepo(link.expanded);
                linkContents.push({ ...link, repo });
              } else if ((link.type === "article" || link.type === "x-article") && link.expanded) {
                const article = yield* fetchArticleText(link.expanded);
                linkContents.push({ ...link, article });
              }
            }
          }

          // 3. AI 解析（仅瞬时调用失败重试一次）
          const cachedVisualFacts = hasReusableVisualFacts(item) ? item.ai.visualFacts : null;
          // ponytail: item-level visual reuse is enough for this personal corpus; add a cross-item media hash cache only if duplicates become material.
          const visualEvidence = cachedVisualFacts ? { images: [] } : yield* collectDesignEvidenceImages(item.media);
          const prompt = DESIGN_ONLY
            ? buildDesignPrompt(item, visualEvidence.images.length, cachedVisualFacts)
            : buildPrompt(item, linkContents, visualEvidence.images.length, cachedVisualFacts, config.taxonomy);
          const parser = DESIGN_ONLY ? parseDesignResponse : parseJsonResponse;
          const parsed = yield* callModel(prompt, visualEvidence.images, parser);

          if (DESIGN_ONLY) {
            Object.assign(item, applyDesignAnalysis(item, parsed.design, { model: MODEL_LABEL }));
          } else {
            Object.assign(
              item,
              applyCurationAnalysis(item, parsed, {
                model: MODEL_LABEL,
                visualEvidenceCount: visualEvidence.images.length,
              }),
            );
          }

          done += 1;
          console.log(`[${done}/${targets.length}] ${item.id} → ${item.ai.title}`);
          yield* persistQueue(); // 每条落盘，按完成顺序串行写入
          yield* Effect.sleep(1000); // 限速
        }).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              failed += 1;
              if (!DESIGN_ONLY) Object.assign(item, recordCurationAnalysisFailure(item, error, { model: MODEL_LABEL }));
              console.error(`[失败] ${item.id}: ${error.message.slice(0, 120)}`);
              yield* persistQueue();
              yield* Effect.sleep(2000);
            }),
          ),
        ),
      );
    }

    yield* Effect.forEach(targets, processItem, { concurrency: CONCURRENCY, discard: true });

    console.log(`\n完成: ${done} 条解析，${failed} 条失败（可重跑续传）`);
    if (failed > 0) process.exitCode = 1;
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await runCli(main());
}
