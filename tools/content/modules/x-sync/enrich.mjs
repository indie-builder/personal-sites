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
  recordDesignAnalysisFailure,
} from "./analysis.mjs";
import { designClassificationStatus } from "./design-classification.mjs";
import { classifyUrl, expandUrl, fetchGithubRepo, fetchArticleText } from "./link-content.mjs";
import { collectDesignEvidenceImages } from "./design-media.mjs";
import { buildPrompt, buildDesignPrompt, parseJsonResponse, parseDesignResponse } from "./prompts.mjs";
import {
  applyPromptContent,
  applyPromptTranslation,
  buildPromptContentPrompt,
  buildPromptTranslationPrompt,
  isPromptItem,
  needsPromptContent,
  parsePromptContentResponse,
  parsePromptTranslationResponse,
  recordPromptContentFailure,
  reusableTranslation,
  translationChunks,
  withFetchedText,
} from "./prompt-content.mjs";
import { cachedPromptSource, PROMPT_SOURCE_VERSION } from "./prompt-source.mjs";
import { writeTextAtomically } from "../../scripts/lib/atomic-file.mjs";

const remoteContent = { expandUrl, fetchGithubRepo, fetchArticleText, collectDesignEvidenceImages };
// 超过此长度的提示词分两步生成译文与标签/回复，避免单次 JSON 输出被截断。
const SHORT_PROMPT_LENGTH = 3_000;

export const enrichQueue = Effect.fn("curation.enrich")(function* (
  { queuePath, taxonomy, modelLabel, dryRun = false, designOnly = false, promptsOnly = false, refresh = false, only = null, limit = Infinity, concurrency },
  { reader: openReader, content = remoteContent, promptSource: openPromptSource = null, logger = console },
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
  let targets = queue.items.filter((item) => {
    if (designOnly) {
      if (!item.ai.enrichedAt) return false;
      if (!item.ai.design) return !(item.pipeline?.stages?.design?.status === "skipped" && !refresh);
      return Boolean(refresh && Number(item.pipeline?.stages?.design?.version ?? 0) < 2);
    }
    if (promptsOnly) return needsPromptContent(item, { refresh });
    // 普通同步只为本次解析出的提示词补内容，外加重试上次失败且未终止的条目。
    return needsCurationAnalysis(item, { refresh })
      || (isPromptItem(item) && item.pipeline?.stages?.prompt?.status === "error");
  });
  if (only) targets = targets.filter((item) => only.has(item.id));
  targets = targets.slice(0, limit);

  const modeLabel = designOnly ? "补设计分类" : promptsOnly ? "补提示词译文与精选回复" : "解析";
  logger.log(
    `待${modeLabel}: ${targets.length} 条，并发 ${concurrency}${refresh ? "（强制刷新）" : ""}${dryRun ? "（dry-run，仅预览计划）" : ""}`,
  );
  if (dryRun) {
    for (const item of targets) {
      if (designOnly || (!promptsOnly && needsCurationAnalysis(item, { refresh }))) {
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
        continue;
      }
      logger.log(
        `[dry-run] ${item.id} @${item.author.handle}: 提示词内容；计划：读取完整原文与最多两页回复，生成译文、开放标签与最多 5 条精选回复`,
      );
    }
    return { done: 0, failed: 0 };
  }
  // 运行前基线落盘（紧凑 JSON），断点续跑依赖它。
  yield* writeTextAtomically(queuePath, `${JSON.stringify(queue)}\n`);

  const reader = yield* openReader;
  const promptAdapter = designOnly ? null : yield* Effect.cached(
    openPromptSource ?? Effect.fail(new Error("缺少提示词抓取源；无法生成译文与精选回复。")),
  );
  // 模型失败后的重试复用上次抓取结果，只有 --refresh 或没有缓存时才重新请求 X。
  const fetchPromptSource = promptAdapter && ((item, force) => {
    const cached = force || refresh ? null : cachedPromptSource(item);
    return cached ? Effect.succeed(cached) : Effect.flatMap(promptAdapter, (adapter) => adapter.fetch(item));
  });

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
        const editorialWork = !designOnly && !promptsOnly && needsCurationAnalysis(item, { refresh });

        if (editorialWork) {
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

        if (editorialWork || designOnly) {
          const cachedVisualFacts = hasReusableVisualFacts(item) ? item.ai.visualFacts : null;
          const visualEvidence = cachedVisualFacts ? { images: [] } : yield* collectDesignEvidenceImages(item.media);
          const prompt = designOnly
            ? buildDesignPrompt(item, visualEvidence.images.length, cachedVisualFacts)
            : buildPrompt(item, linkContents, visualEvidence.images.length, cachedVisualFacts, taxonomy);
          const parser = designOnly ? parseDesignResponse : parseJsonResponse;
          const parsed = yield* callModel(prompt, visualEvidence.images, parser);

          Object.assign(
            item,
            designOnly
              ? applyDesignAnalysis(item, parsed.design, { model: modelLabel })
              : applyCurationAnalysis(item, parsed, {
                  model: modelLabel,
                  visualEvidenceCount: visualEvidence.images.length,
                  vocabulary: taxonomy ?? [],
                }),
          );
        }

        // 普通解析把条目识别成提示词后才补译文与精选回复；已有完整内容的不重做。
        const promptWork = !designOnly && (promptsOnly || isPromptItem(item));
        if (promptWork && needsPromptContent(item, { refresh })) {
          const source = yield* fetchPromptSource(item, refresh);
          // 抓到的完整正文立刻并入条目；回复候选随条目缓存，模型失败重试时不必重复抓取 X。
          Object.assign(item, withFetchedText(item, source));
          item.promptSource = {
            fetchedAt: source.fetchedAt,
            fullText: item.text,
            quoteText: item.quoteContext?.text ?? null,
            replies: source.replies,
            version: PROMPT_SOURCE_VERSION,
          };
          // 长内容先单独翻译：整篇一次生成容易被输出上限截断；超长原文再按段落分块。
          const translateFirst = item.text.length > SHORT_PROMPT_LENGTH;
          if (translateFirst) {
            // 第二步失败后重试时复用已保存的译文，避免整篇重新翻译。
            const reusable = reusableTranslation(item);
            if (!reusable) {
              const chunks = translationChunks(item.text);
              let translated = null;
              for (const [index, chunk] of chunks.entries()) {
                const part = yield* callModel(
                  buildPromptTranslationPrompt(item, { chunk, index, total: chunks.length }),
                  [],
                  parsePromptTranslationResponse,
                );
                translated = {
                  quoteTranslation: part.quoteTranslation ?? translated?.quoteTranslation ?? null,
                  translation: chunks.length === 1 ? part.translation : [translated?.translation, part.translation].filter(Boolean).join("\n") || null,
                };
              }
              Object.assign(item, applyPromptTranslation(item, translated ?? { translation: null, quoteTranslation: null }, source, { model: modelLabel }));
            }
          }
          const contentPrompt = yield* attempt("curation.prompt-build", () =>
            buildPromptContentPrompt(item, source.replies, { taxonomy }));
          const parsed = yield* callModel(contentPrompt, [], parsePromptContentResponse);
          const enriched = yield* attempt("curation.prompt-content", () =>
            applyPromptContent(item, {
              ...parsed,
              translation: translateFirst ? item.ai.prompt?.translation ?? null : parsed.translation,
              quoteTranslation: translateFirst
                ? (item.ai.prompt?.quoteTranslation ?? parsed.quoteTranslation) ?? null
                : parsed.quoteTranslation,
            }, source, { model: modelLabel, vocabulary: taxonomy ?? [] }));
          Object.assign(item, enriched);
        }

        done += 1;
        logger.log(`[${done}/${targets.length}] ${item.id} → ${item.ai.title}`);
        yield* persistQueue(); // 每条落盘，按完成顺序串行写入
        yield* Effect.sleep(1000); // 限速
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            failed += 1;
            if (designOnly) Object.assign(item, recordDesignAnalysisFailure(item, error, { model: modelLabel }));
            else if (!promptsOnly && needsCurationAnalysis(item, { refresh })) {
              Object.assign(item, recordCurationAnalysisFailure(item, error, { model: modelLabel }));
            } else Object.assign(item, recordPromptContentFailure(item, error, { model: modelLabel }));
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
