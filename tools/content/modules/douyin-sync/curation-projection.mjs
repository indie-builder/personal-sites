import { toIsoDate, toOrder } from "../x-sync/curation-projection.mjs";

export function toPublicDouyinItem(item) {
  const id = `douyin-${item.id.replace(/^douyin:/u, "")}`;
  return {
    analysis: item.ai.analysis,
    author: item.author,
    collectedAt: toIsoDate(item.collectedAt),
    collectedOrder: toOrder(item.collectedOrder),
    id,
    links: [],
    media: [],
    publishedAt: toIsoDate(item.publishedAt),
    quoteContext: null,
    source: {
      label: "抖音视频",
      platform: "douyin",
      url: item.sourceUrl,
    },
    summary: item.ai.summary,
    tags: item.ai.tags,
    text: item.ai.excerpt,
    excerptTime: item.ai.excerptTime ?? null,
    title: item.ai.title,
  };
}
