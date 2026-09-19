#!/usr/bin/env node
/** Generate the public, Git-tracked SQLite projection from private focus queues. */

import { readFile } from "node:fs/promises";

import { readJsonOr } from "./lib/json-file.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import { PUBLIC_CURATION_DATABASE_PATH, buildPublicCurationDatabase } from "../modules/focus-sync/public-sqlite.mjs";
import { summarizeDesignClassifications } from "../modules/x-sync/design-classification.mjs";
import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";
import { rebuildDefaultIndex } from "./local-vectors.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"));
const queue = JSON.parse(await readFile(path.join(repoRoot, config.queueFile), "utf8"));
const douyinConfig = JSON.parse(await readFile(path.join(repoRoot, "config/douyin-curation.json"), "utf8"));

const douyinQueue = await readJsonOr(path.join(repoRoot, douyinConfig.queueFile), { items: [] });
const xItems = queue.items.filter(isReadyForPublication).map(toPublicCurationItem);
const items = [
  ...xItems,
  ...douyinQueue.items.map(toPublicDouyinItem),
];

/**
 * 跨来源重复只提示不处理：同一事件在 X 与抖音各自成条时，
 * 是否清理由发布者自行决定，提示本身不影响发布结果。
 */
function normalizeTitle(title) {
  return title.replace(/[，。！？、：；“”‘’"'（）()【】[\]\s]/gu, "");
}

function titleBigrams(value) {
  const grams = new Set();
  for (let index = 0; index < value.length - 1; index += 1) grams.add(value.slice(index, index + 2));
  return grams;
}

function titleSimilarity(left, right) {
  const leftGrams = titleBigrams(left);
  const rightGrams = titleBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;
  let overlap = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1;
  return overlap / (leftGrams.size + rightGrams.size - overlap);
}

function findDuplicateCandidates(publishedItems) {
  const normalized = publishedItems.map((item) => normalizeTitle(item.title));
  const candidates = [];
  for (let left = 0; left < publishedItems.length; left += 1) {
    for (let right = left + 1; right < publishedItems.length; right += 1) {
      const [a, b] = [normalized[left], normalized[right]];
      if (a.length < 6 || b.length < 6) continue;
      if (a.includes(b) || b.includes(a) || titleSimilarity(a, b) >= 0.6) {
        candidates.push([publishedItems[left], publishedItems[right]]);
      }
    }
  }
  return candidates;
}

const duplicates = findDuplicateCandidates(items);
if (duplicates.length > 0) {
  console.log(`疑似重复条目 ${duplicates.length} 对（仅提示，不影响发布）：`);
  for (const [left, right] of duplicates.slice(0, 10)) {
    console.log(`  ${left.id} ↔ ${right.id}：${left.title} / ${right.title}`);
  }
}

const result = await buildPublicCurationDatabase({
  outputPath: path.join(repoRoot, PUBLIC_CURATION_DATABASE_PATH),
  items,
});

console.log(`公开 SQLite 已生成：${PUBLIC_CURATION_DATABASE_PATH}（策展 ${result.itemCount} 条，问答索引 ${result.documentCount} 条）。`);
const designSummary = summarizeDesignClassifications(xItems);
console.log(`设计分类：收录 ${designSummary.include}，排除 ${designSummary.exclude}，未分类 ${designSummary.unclassified}；可直接播放视频 ${designSummary.playableVideos}。`);
await rebuildDefaultIndex();
