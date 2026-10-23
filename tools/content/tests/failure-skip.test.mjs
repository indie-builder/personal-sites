import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_STAGE_ATTEMPTS,
  needsCurationAnalysis,
  recordCurationAnalysisFailure,
  recordDesignAnalysisFailure,
} from "../modules/x-sync/analysis.mjs";
import { isPermanentDouyinFailure } from "../scripts/douyin-curation.mjs";

const item = { author: { handle: "fixture" }, fetchSource: "bookmarks", links: [], media: [], text: "synthetic" };

function applyFailures(record, times) {
  let current = item;
  for (let i = 0; i < times; i += 1) current = record(current, new Error("boom"));
  return current;
}

test("X editorial analysis is terminated (skipped) after MAX_STAGE_ATTEMPTS and stops being retried", () => {
  const exhausted = applyFailures(recordCurationAnalysisFailure, MAX_STAGE_ATTEMPTS);
  assert.equal(exhausted.pipeline.stages.editorial.status, "skipped");
  assert.equal(needsCurationAnalysis(exhausted), false);
  // 显式 --refresh 才允许重来。
  assert.equal(needsCurationAnalysis(exhausted, { refresh: true }), true);
  // 未达上限仍为 error，继续重试。
  const retrying = applyFailures(recordCurationAnalysisFailure, 1);
  assert.equal(retrying.pipeline.stages.editorial.status, "error");
  assert.equal(needsCurationAnalysis(retrying), true);
});

test("X design classification is terminated after MAX_STAGE_ATTEMPTS", () => {
  const base = { ...item, ai: { enrichedAt: "2026-08-29T10:00:00.000Z" } };
  let current = base;
  for (let i = 0; i < MAX_STAGE_ATTEMPTS; i += 1) current = recordDesignAnalysisFailure(current, new Error("boom"));
  assert.equal(current.pipeline.stages.design.status, "skipped");
});

test("Douyin permanent failures (no transcript/OCR) are marked skipped", () => {
  assert.equal(isPermanentDouyinFailure("没有可用于公开摘录的转写或 OCR 原句。"), true);
  assert.equal(isPermanentDouyinFailure("视频分析没有得到语音转写或屏幕文字，保留原视频但不生成公开条目。"), true);
  assert.equal(isPermanentDouyinFailure("模型返回缺少 title。"), false);
  assert.equal(isPermanentDouyinFailure("分析引擎探活失败"), false);
});
