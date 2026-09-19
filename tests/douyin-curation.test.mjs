import assert from "node:assert/strict";
import test from "node:test";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import {
  buildCurationPrompt,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toQueueItem,
} from "../modules/douyin-sync/import.mjs";
import { parseArgs, settleConcurrently } from "../scripts/douyin-curation.mjs";
import { parseFullSyncArgs } from "../scripts/douyin-full-sync.mjs";

test("Douyin manifest and analyzer output form an auditable queue item", () => {
  const [record] = parseDownloadManifest(`${JSON.stringify({
    author_name: "作者",
    author_sec_uid: "sec-id",
    aweme_id: "123",
    desc: "介绍一个项目",
    file_paths: ["作者/collect/demo.mp4"],
    media_type: "video",
    publish_timestamp: 1_700_000_000,
    recorded_at: "2026-08-23T10:00:00.000Z",
  })}\n`);
  const video = { ...toDouyinVideo(record, "/downloads"), collectedOrder: 2 };
  const evidence = parseAnalyzerOutput({
    metadata: { title: "demo" },
    ocrResults: [{ confidence: 90, text: "Example Project", time: "0:03" }],
    timeline: [{ ocrText: "Example Project", time: "0:03", transcript: "今天介绍它" }],
    transcript: [{ text: "今天介绍它", time: "0:03" }],
    warnings: [],
  });
  const parsed = parseCurationResponse(JSON.stringify({
    analysis: "**是什么**\n\n解析内容",
    excerpt: "今天介绍它",
    mentionedProjects: [{
      description: "视频中的项目",
      evidence: [{ channel: "ocr", text: "Example Project", time: "0:03" }],
      kind: "tool",
      name: "Example Project",
    }],
    summary: "摘要",
    tags: ["AI 应用"],
    title: "值得留意的示例项目",
  }));
  parsed.ai.excerpt = groundEvidenceExcerpt("Example Project", evidence).text;
  const item = toQueueItem(video, parsed, "data/sensitive/douyin-curation/raw/123/analysis.json");

  assert.equal(video.videoPath, "/downloads/作者/collect/demo.mp4");
  assert.match(buildCurationPrompt(video, evidence, ["AI 应用"]), /屏幕文字 OCR/u);
  assert.equal(item.collectedOrder, 2);
  assert.equal(item.ai.excerpt, "Example Project");
  assert.deepEqual(groundEvidenceExcerpt("Example Project", evidence), { text: "Example Project", time: "0:03" });
  assert.equal(item.mentionedProjects[0].verification, "unresolved");
  const publicItem = toPublicDouyinItem(item);
  assert.equal(publicItem.id, "douyin-123");
  assert.deepEqual(publicItem.source, {
    label: "抖音视频",
    platform: "douyin",
    url: "https://www.douyin.com/video/123",
  });
  assert.equal(publicItem.collectedOrder, 2);
});

test("Douyin importer rejects malformed or evidence-free input", () => {
  assert.throws(() => parseDownloadManifest("not-json\n"), /第 1 行/u);
  assert.throws(() => parseAnalyzerOutput({ ocrResults: [], transcript: [] }), /没有得到语音转写或屏幕文字/u);
  assert.deepEqual(parseArgs(["sync", "--manifest", "downloads/download_manifest.jsonl", "--limit", "5"]), {
    analyzerConcurrency: null,
    concurrency: null,
    dryRun: false,
    engine: "zcode",
    force: false,
    limit: 5,
    manifest: "downloads/download_manifest.jsonl",
    refreshOnly: false,
    stage: "sync",
  });
  assert.equal(parseArgs(["sync", "--manifest", "downloads/download_manifest.jsonl", "--refresh-only"]).refreshOnly, true);
  assert.equal(parseArgs(["sync", "--dry-run"]).manifest, null);
  assert.deepEqual(parseFullSyncArgs(["--skip-download", "--analyze-limit", "20"]), {
    analyze: true,
    analyzeLimit: 20,
    analyzerConcurrency: null,
    concurrency: null,
    download: false,
    dryRun: false,
    engine: "zcode",
  });
  assert.equal(parseFullSyncArgs(["--dry-run"]).dryRun, true);
  assert.throws(() => parseArgs(["approve", "douyin:123"]), /不接受/u);
});

test("Curated tags are normalized against the configured taxonomy whitelist", () => {
  const response = JSON.stringify({
    analysis: "分析",
    excerpt: "摘录",
    summary: "摘要",
    tags: ["前端", "自创标签"],
    title: "标题",
  });
  const parsed = parseCurationResponse(response, { allowedTags: ["AI 应用", "前端工程"] });
  assert.deepEqual(parsed.ai.tags, ["前端工程"]);

  assert.throws(
    () => parseCurationResponse(JSON.stringify({ analysis: "分析", excerpt: "摘录", summary: "摘要", tags: ["乱编"], title: "标题" }), {
      allowedTags: ["AI 应用"],
    }),
    /白名单/u,
  );
  assert.doesNotThrow(
    () => parseCurationResponse(JSON.stringify({ analysis: "分析", excerpt: "摘录", summary: "摘要", tags: ["随便写的标签"], title: "标题" })),
  );
});

test("Evidence truncation declares how much of the video the model can see", () => {
  const transcript = Array.from({ length: 900 }, (_, index) => ({
    speaker: "主讲",
    text: `第${index}段内容，用于撑满证据窗口的转写句子。`,
    time: `${Math.floor(index / 60)}:${String(index % 60).padStart(2, "0")}`,
  }));
  const evidence = parseAnalyzerOutput({ metadata: {}, ocrResults: [], timeline: [], transcript, warnings: [] });
  const prompt = buildCurationPrompt(
    { sourceUrl: "https://www.douyin.com/video/1", author: { name: "作者" }, description: "", tags: [] },
    evidence,
    ["AI 应用"],
  );
  assert.match(prompt, /仅覆盖至/u);
  assert.doesNotMatch(prompt, /第899段/u);
});

test("Douyin worker pool records one failure without stopping later work", async () => {
  const completed = [];
  const failures = await settleConcurrently([1, 2, 3], 2, async (value) => {
    if (value === 2) throw new Error("broken");
    completed.push(value);
  });

  assert.deepEqual(completed.sort(), [1, 3]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].target, 2);
  assert.match(failures[0].error.message, /broken/u);
});
