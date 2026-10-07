import { readFile } from "node:fs/promises";
import { Effect, Semaphore } from "effect";
import { attempt, io } from "@site/effect";
import { withModelRetry } from "../analysis/retry.mjs";
import {
  applyCurationAnalysis,
  applyDesignAnalysis,
  hasReusableVisualFacts,
  needsCurationAnalysis,
  prepareCurationItem,
  recordCurationAnalysisFailure,
} from "./analysis.mjs";
import { designClassificationStatus } from "./design-classification.mjs";
import { classifyUrl, expandUrl, fetchGithubRepo, fetchArticleText } from "./link-content.mjs";
import { collectDesignEvidenceImages } from "./design-media.mjs";
import { buildPrompt, buildDesignPrompt, parseJsonResponse, parseDesignResponse } from "./prompts.mjs";
import { writeTextAtomically } from "../../scripts/lib/atomic-file.mjs";

const remoteContent = { expandUrl, fetchGithubRepo, fetchArticleText, collectDesignEvidenceImages };

export const enrichQueue = Effect.fn("curation.enrich")(function* (
  { queuePath, taxonomy, modelLabel, dryRun = false, designOnly = false, refresh = false, only = null, limit = Infinity, concurrency },
  { reader: openReader, content = remoteContent, logger = console },
) {
  const { expandUrl, fetchGithubRepo, fetchArticleText, collectDesignEvidenceImages } = content;
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
    logger.log(`${dryRun ? "预览校正" : "已校正"} ${normalizedStatuses} 条历史设计分类状态。`);
  }
  let targets = queue.items.filter((item) =>
    designOnly
      ? item.ai.enrichedAt && (!item.ai.design || (refresh && Number(item.pipeline?.stages?.design?.version ?? 0) < 2))
      : needsCurationAnalysis(item, { refresh }),
  );
  if (only) targets = targets.filter((item) => only.has(item.id));
  targets = targets.slice(0, limit);

  logger.log(
    `待${designOnly ? "补设计分类" : "解析"}: ${targets.length} 条，并发 ${concurrency}${refresh ? "（强制刷新）" : ""}${dryRun ? "（dry-run，仅预览计划）" : ""}`,
  );
  if (dryRun) {
    for (const item of targets) {
      const links = item.links ?? [];
      const linkTypes = [...new Set(links.map((link) => link.type ?? "external"))].join("、") || "无";
      const unresolved = links.filter((link) => link.type === "unexpanded").length;
      const fetchable = links.filter((link) =>
        link.expanded && ["github", "article", "x-article"].includes(link.type),
      ).length;
      const visualWork = hasReusableVisualFacts(item) ? "复用视觉事实" : "收集媒体证据";
      logger.log(
        `[dry-run] ${item.id} @${item.author.handle}: 现有链接类型 ${linkTypes}，未展开 ${unresolved}/${links.length}，媒体 ${item.media?.length ?? 0}；计划：${designOnly ? "补设计分类" : `展开 ${unresolved} 条短链、抓取 ${fetchable} 条已解析链接及展开后支持的链接、完整解析`}，${visualWork}`,
      );
    }
    return { done: 0, failed: 0 };
  }
  // 运行前基线落盘（紧凑 JSON），断点续跑依赖它。
  yield* writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`);

  const reader = yield* openReader;

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

        if (!designOnly) {
          for (const link of item.links) {
            if (link.type !== "unexpanded") continue;
            const expanded = yield* expandUrl(link.original);
            if (expanded) {
              link.expanded = expanded;
              link.type = classifyUrl(expanded);
            }
            yield* Effect.sleep(300);
          }

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

        const cachedVisualFacts = hasReusableVisualFacts(item) ? item.ai.visualFacts : null;
        const visualEvidence = cachedVisualFacts ? { images: [] } : yield* collectDesignEvidenceImages(item.media);
        const prompt = designOnly
          ? buildDesignPrompt(item, visualEvidence.images.length, cachedVisualFacts)
          : buildPrompt(item, linkContents, visualEvidence.images.length, cachedVisualFacts, taxonomy);
        const parser = designOnly ? parseDesignResponse : parseJsonResponse;
        const parsed = yield* callModel(prompt, visualEvidence.images, parser);

        if (designOnly) {
          Object.assign(item, applyDesignAnalysis(item, parsed.design, { model: modelLabel }));
        } else {
          Object.assign(
            item,
            applyCurationAnalysis(item, parsed, {
              model: modelLabel,
              visualEvidenceCount: visualEvidence.images.length,
            }),
          );
        }

        done += 1;
        logger.log(`[${done}/${targets.length}] ${item.id} → ${item.ai.title}`);
        yield* persistQueue(); // 每条落盘，按完成顺序串行写入
        yield* Effect.sleep(1000); // 限速
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            failed += 1;
            if (!designOnly) Object.assign(item, recordCurationAnalysisFailure(item, error, { model: modelLabel }));
            logger.error(`[失败] ${item.id}: ${error.message.slice(0, 120)}`);
            yield* persistQueue();
            yield* Effect.sleep(2000);
          }),
        ),
      ),
    );
  }

  yield* Effect.forEach(targets, processItem, { concurrency, discard: true });

  logger.log(`\n完成: ${done} 条解析，${failed} 条失败（可重跑续传）`);
  return { done, failed };
});
