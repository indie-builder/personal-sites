import { designClassificationStatus } from "./design-classification.mjs";
import { prepareCurationItem } from "./analysis.mjs";
import { hasVerifiedTranslation, PROMPT_STAGE_VERSION } from "./prompt-content.mjs";
import { PROMPT_SOURCE_VERSION } from "./prompt-source.mjs";

export function isReadyForPublication(item) {
  return Boolean(
    item.ai?.title
      && item.ai.summary
      && item.ai.analysis
      && Array.isArray(item.ai.tags)
      && item.ai.tags.length > 0,
  );
}

export function toIsoDate(createdAt) {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function toOrder(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function toPublicPrompt(item) {
  const prompt = item.ai?.prompt;
  const stage = item.pipeline?.stages?.prompt;
  if (!prompt || item.promptSource?.version !== PROMPT_SOURCE_VERSION) return null;
  // 译文已按当前原文校验通过即可先发布译文；追评未补齐时只省略追评。
  const ready = hasVerifiedTranslation(item)
    || (stage?.status === "complete" && stage?.version === PROMPT_STAGE_VERSION);
  if (!ready) return null;
  return {
    quoteTranslation: prompt.quoteTranslation ?? null,
    replies: (prompt.replies ?? []).map((reply) => ({
      author: { handle: reply.author?.handle ?? "", name: reply.author?.name ?? "" },
      id: reply.id,
      media: (reply.media ?? []).filter((media) => media.url),
      reason: reply.reason,
      text: reply.text,
      translation: reply.translation ?? null,
      url: reply.url,
    })),
    translation: prompt.translation ?? null,
  };
}

export function toPublicCurationItem(item) {
  const prepared = prepareCurationItem(item);
  const prompt = toPublicPrompt(prepared);
  return {
    id: prepared.id,
    title: prepared.ai.title,
    summary: prepared.ai.summary,
    tags: prepared.ai.tags,
    text: prepared.text,
    prompt,
    facts: prepared.facts,
    searchSignals: prepared.ai.searchSignals ?? null,
    visualFacts: prepared.ai.visualFacts ?? null,
    quoteContext:
      prepared.isQuote && prepared.quoteContext
        ? {
            author: prepared.quoteContext.author ?? "",
            authorName: prepared.quoteContext.authorName ?? "",
            text: prepared.quoteContext.text ?? "",
          }
        : null,
    analysis: prepared.ai.analysis,
    design: prepared.ai.design
      ? {
          ...prepared.ai.design,
          status: designClassificationStatus(prepared.ai.design.relevant),
        }
      : null,
    author: {
      handle: prepared.author.handle,
      name: prepared.author.name,
    },
    source: {
      label: "X 原文",
      platform: "x",
      url: prepared.tweetUrl,
    },
    links: [
      ...new Map(
        prepared.links
          .filter((link) => link.expanded && link.type !== "tweet")
          .map((link) => [
            link.expanded,
            { type: link.type, url: link.expanded, shortUrl: link.original ?? null },
          ]),
      ).values(),
    ],
    media: (prepared.media ?? []).filter((media) => media.url),
    collectedAt: toIsoDate(prepared.firstSeenAt),
    collectedOrder: toOrder(prepared.firstSeenOrder),
    publishedAt: toIsoDate(prepared.createdAt),
  };
}
