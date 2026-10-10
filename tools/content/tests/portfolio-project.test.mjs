// 作品集公开投影（publisher）行为测试：去重离线化、媒体物化、隐私列剔除、原子发布。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import { Cause, Effect, Exit } from "effect";

import { openDatabase } from "../modules/portfolio/inspora/db.ts";
import { projectLayouts, publishPortfolio, videoPreviewUrl } from "../modules/portfolio/project.mjs";

function fixtureInput(t, name) {
  const root = mkdtempSync(path.join(tmpdir(), `portfolio-${name}-`));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const LAYOUT_ITEM = {
  id: "001",
  name: "三分法构图",
  category: "构图逻辑",
  category_slug: "01-composition-logic",
  subcategory: "经典构图",
  subcategory_slug: "classic",
  image: "images/layout-001.png",
  thumbnail: "thumbnails/001.png",
  width: 1200,
  height: 800,
  sha256: "0".repeat(64),
};

const TOOLS_CATALOG = {
  sourceUrl: "https://example.com/tools",
  syncedAt: "2026-10-01T00:00:00.000Z",
  categories: [{ id: "Inspiration", tools: [{ name: "示例", url: "https://example.com", icon: null }] }],
};

function writeInputs(root, { catalog = [LAYOUT_ITEM], corrections = {}, tools = TOOLS_CATALOG } = {}) {
  mkdirSync(path.join(root, "design-engineer-tools"), { recursive: true });
  writeFileSync(path.join(root, "catalog.json"), JSON.stringify(catalog));
  writeFileSync(path.join(root, "corrections.json"), JSON.stringify(corrections));
  writeFileSync(path.join(root, "design-engineer-tools/catalog.json"), JSON.stringify(tools));
}

const SYNCED = "2026-09-30T06:00:00.000Z";

function addPost(stmts, row) {
  stmts.upsertPost({
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? row.id,
    category: row.category ?? null,
    source: row.source ?? "inspora",
    tweetId: row.tweetId ?? null,
    sourceUrl: row.tweetId ? `https://x.com/author/status/${row.tweetId}` : null,
    createdAt: row.createdAt ?? "2026-09-30T06:00:00.000Z",
    syncedAt: SYNCED,
  });
  for (const [index, media] of (row.media ?? []).entries()) {
    stmts.upsertMedia({
      postId: row.id,
      id: media.id,
      position: media.position ?? index,
      type: media.type ?? "image",
      url: media.url ?? `https://cdn.example.com/${media.id}`,
      posterUrl: media.posterUrl ?? null,
      width: media.width ?? null,
      height: media.height ?? null,
      sizeBytes: media.sizeBytes ?? null,
      alt: media.alt ?? null,
      localPath: media.localPath ?? null,
      localPosterPath: media.localPosterPath ?? null,
      localThumbPath: media.localThumbPath ?? null,
      raw: media.raw ?? null,
    });
  }
}

function seedRawDb(root, seed) {
  const { db, stmts } = openDatabase(path.join(root, "inspora.db"));
  seed({ db, stmts });
  db.close();
}

async function publish(root, overrides = {}) {
  const output = path.join(root, "out");
  mkdirSync(output, { recursive: true });
  const dataDir = path.join(output, "data");
  const outputPath = path.join(output, "portfolio.sqlite");
  const summary = await Effect.runPromise(
    publishPortfolio({ inputRoot: root, outputPath, dataDir, ...overrides }),
  );
  return { summary, outputPath, dataDir };
}

test("三源去重在离线投影时一次完成：隐藏原作不进公开库", async (t) => {
  const root = fixtureInput(t, "dedup");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => {
    addPost(stmts, { id: "inspora-original", source: "inspora", tweetId: "1", category: "Motion" });
    addPost(stmts, { id: "x-original", source: "bestx", tweetId: "1", category: "hidden" });
    addPost(stmts, { id: "c-original", source: "collectui", tweetId: "1", category: "hidden" });
    addPost(stmts, { id: "x-second", source: "bestx", tweetId: "2" });
    addPost(stmts, { id: "c-second", source: "collectui", tweetId: "2" });
    addPost(stmts, { id: "c-new", source: "collectui", tweetId: "3" });
    addPost(stmts, { id: "c-duplicate", source: "collectui", tweetId: "3" });
    addPost(stmts, { id: "no-tweet", source: "inspora", tweetId: null });
  });
  const { summary, outputPath } = await publish(root);
  assert.equal(summary.posts, 4);
  assert.equal(summary.hiddenDropped, 4);
  const db = new Database(outputPath, { readonly: true });
  assert.deepEqual(
    db.prepare("SELECT slug FROM muse_posts ORDER BY slug").all().map((row) => row.slug),
    // 同源同推文按 id 字符串序保留更小者：c-duplicate < c-new
    ["c-duplicate", "inspora-original", "no-tweet", "x-second"],
  );
  db.close();
});

test("媒体地址物化：本地存在用本地路径，缺失回退热链；视频预览从 raw_json 提取", async (t) => {
  const root = fixtureInput(t, "media");
  writeInputs(root);
  const publicDir = path.join(root, "public");
  mkdirSync(path.join(publicDir, "inspora/posters"), { recursive: true });
  writeFileSync(path.join(publicDir, "inspora/posters/local.webp"), "poster");
  const preview = "https://example.com/preview.mp4";
  const full = "https://example.com/full.mp4";
  seedRawDb(root, ({ stmts }) => {
    addPost(stmts, {
      id: "media-post",
      media: [
        {
          id: "local-image",
          localPath: "/inspora/posters/local.webp",
          localThumbPath: "/inspora/posters/local.webp",
          url: "https://cdn.example.com/missing-local.png",
          posterUrl: "https://cdn.example.com/poster.png",
        },
        {
          id: "hotlink-video",
          type: "video",
          url: full,
          raw: { id: "hotlink-video", videoPreview: { url: preview, bytes: 10 }, sizeBytes: 100, width: 1080, height: 720 },
        },
        {
          id: "javascript-preview",
          type: "video",
          url: full,
          raw: { id: "javascript-preview", videoPreview: { url: "javascript:bad", bytes: 10 }, sizeBytes: 100 },
        },
        {
          id: "mismatch-preview",
          type: "video",
          url: full,
          raw: { id: "other", videoPreview: { url: preview, bytes: 10 }, sizeBytes: 100 },
        },
      ],
    });
  });
  const { outputPath } = await publish(root, { publicDir });
  const db = new Database(outputPath, { readonly: true });
  const media = db.prepare("SELECT id, src, preview_src, poster, thumb FROM muse_media ORDER BY position").all();
  assert.deepEqual(media[0], {
    id: "local-image",
    src: "/inspora/posters/local.webp",
    preview_src: "/inspora/posters/local.webp",
    poster: "https://cdn.example.com/poster.png",
    thumb: "/inspora/posters/local.webp",
  });
  assert.equal(media[1].src, full);
  assert.equal(media[1].preview_src, preview);
  assert.equal(media[2].preview_src, full);
  assert.equal(media[3].preview_src, full);
  db.close();
});

test("videoPreviewUrl 端口保留源的取舍规则", () => {
  const full = "https://example.com/full.mp4";
  assert.equal(videoPreviewUrl({ type: "image", raw_json: "{}" }, full), full);
  assert.equal(videoPreviewUrl({ type: "video", raw_json: "{broken", id: "x" }, full), full);
  assert.equal(videoPreviewUrl({ type: "video", raw_json: null, id: "x" }, full), full);
  assert.equal(
    videoPreviewUrl(
      { type: "video", id: "x", raw_json: JSON.stringify({ id: "x", videoPreview: { url: "javascript:bad" } }) },
      full,
    ),
    full,
  );
  // 预览不小于完整体积且分辨率不小 → 弃用
  assert.equal(
    videoPreviewUrl(
      {
        type: "video",
        id: "x",
        raw_json: JSON.stringify({ id: "x", sizeBytes: 10, videoPreview: { url: "https://p/big", bytes: 20 } }),
      },
      full,
    ),
    full,
  );
  // 体积不小但分辨率更小 → 采用
  assert.equal(
    videoPreviewUrl(
      {
        type: "video",
        id: "x",
        raw_json: JSON.stringify({
          id: "x",
          sizeBytes: 10,
          width: 1000,
          height: 1000,
          videoPreview: { url: "https://p/small", bytes: 20, width: 100, height: 100 },
        }),
      },
      full,
    ),
    "https://p/small",
  );
});

test("投影剔除内部列；meta 记录计数", async (t) => {
  const root = fixtureInput(t, "schema");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => {
    addPost(stmts, { id: "p1", tweetId: "9", source: "bestx" });
  });
  const { outputPath } = await publish(root);
  const db = new Database(outputPath, { readonly: true });
  const postColumns = db.prepare("PRAGMA table_info(muse_posts)").all().map((row) => row.name);
  for (const forbidden of ["raw_json", "enriched_at", "synced_at", "source", "tweet_id"]) {
    assert.ok(!postColumns.includes(forbidden), `muse_posts 不应包含 ${forbidden}`);
  }
  const mediaColumns = db.prepare("PRAGMA table_info(muse_media)").all().map((row) => row.name);
  for (const forbidden of [
    "raw_json",
    "size_bytes",
    "local_path",
    "local_poster_path",
    "local_thumb_path",
    "url",
    "poster_url",
  ]) {
    assert.ok(!mediaColumns.includes(forbidden), `muse_media 不应包含 ${forbidden}`);
  }
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  assert.deepEqual(tables.sort(), ["muse_media", "muse_posts", "portfolio_meta"]);
  const counts = JSON.parse(db.prepare("SELECT value FROM portfolio_meta WHERE key='counts'").get().value);
  assert.equal(counts.posts, 1);
  db.close();
});

test("发布失败保留旧产物：输入损坏时不覆盖已发布的库", async (t) => {
  const root = fixtureInput(t, "atomic");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "good" }));
  const { outputPath } = await publish(root);
  const before = new Database(outputPath, { readonly: true });
  assert.equal(before.prepare("SELECT COUNT(*) c FROM muse_posts").get().c, 1);
  before.close();

  writeFileSync(path.join(root, "catalog.json"), "{ broken");
  const failure = await Effect.runPromiseExit(
    publishPortfolio({ inputRoot: root, outputPath, dataDir: path.join(root, "out", "data2") }),
  );
  assert.ok(Exit.isFailure(failure), "损坏输入必须失败");
  const after = new Database(outputPath, { readonly: true });
  assert.equal(after.prepare("SELECT COUNT(*) c FROM muse_posts").get().c, 1, "旧产物保留");
  assert.ok(!existsSync(path.join(root, "out", "data2", "layouts.json")), "失败不落新目录投影");
  after.close();
});

test("工具目录只发布分类并剔除同步元数据；Schema 不合时失败不动旧产物", async (t) => {
  const root = fixtureInput(t, "tools-public");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "p1" }));
  const { outputPath, dataDir, summary } = await publish(root);
  const published = JSON.parse(readFileSync(path.join(dataDir, "tools.json"), "utf8"));
  assert.deepEqual(Object.keys(published), ["categories"], "公开工具目录只保留 categories");
  assert.deepEqual(published.categories, [
    { id: "Inspiration", tools: [{ name: "示例", url: "https://example.com", icon: null }] },
  ]);
  assert.equal(summary.tools, 1);

  writeInputs(root, {
    tools: { sourceUrl: "https://example.com/tools", syncedAt: "2026-10-02T00:00:00.000Z", categories: [{ id: "X", tools: [{ name: "缺 url" }] }] },
  });
  const failure = await Effect.runPromiseExit(publishPortfolio({ inputRoot: root, outputPath, dataDir }));
  assert.ok(Exit.isFailure(failure), "缺 url 的工具条目必须失败");
  assert.match(String(Cause.squash(failure.cause).message), /工具目录不符合公开 Schema/);
  assert.equal(
    JSON.parse(readFileSync(path.join(dataDir, "tools.json"), "utf8")).categories[0].id,
    "Inspiration",
    "旧工具目录保留",
  );
});

test("库损坏时已变的目录 JSON 也不落盘：先全部校验再统一替换", async (t) => {
  const root = fixtureInput(t, "invalid-db");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "stable" }));
  const { outputPath, dataDir } = await publish(root);
  const oldLayouts = readFileSync(path.join(dataDir, "layouts.json"), "utf8");
  const oldTools = readFileSync(path.join(dataDir, "tools.json"), "utf8");

  writeInputs(root, { catalog: [{ ...LAYOUT_ITEM, id: "002", name: "新条目" }] });
  writeFileSync(path.join(root, "inspora.db"), "not a sqlite database");
  const failure = await Effect.runPromiseExit(publishPortfolio({ inputRoot: root, outputPath, dataDir }));
  assert.ok(Exit.isFailure(failure), "损坏源库必须失败");
  assert.equal(readFileSync(path.join(dataDir, "layouts.json"), "utf8"), oldLayouts, "旧图鉴保留");
  assert.equal(readFileSync(path.join(dataDir, "tools.json"), "utf8"), oldTools, "旧工具目录保留");
  const db = new Database(outputPath, { readonly: true });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM muse_posts").get().c, 1, "旧库保留");
  db.close();
  assert.deepEqual(readdirSync(dataDir).sort(), ["layouts.json", "tools.json"], "无暂存/备份残留");
  const outEntries = readdirSync(path.dirname(outputPath)).sort();
  assert.deepEqual(outEntries, ["data", "portfolio.sqlite"], "无锁/暂存目录残留");
});

test("替换中途失败回滚已上位的产物：目标被目录占据时不留半成品", async (t) => {
  const root = fixtureInput(t, "rollback");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "before" }));
  const { outputPath, dataDir } = await publish(root);
  const oldLayouts = readFileSync(path.join(dataDir, "layouts.json"), "utf8");

  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "after" }));
  writeInputs(root, {
    catalog: [{ ...LAYOUT_ITEM, id: "002", name: "新条目" }],
    tools: { ...TOOLS_CATALOG, categories: [{ id: "Fonts", tools: [{ name: "另一工具", url: "https://example.com/2", icon: null }] }] },
  });
  // tools.json 目标被非空目录占据：备份 link 立即失败，此时库与图鉴已替换
  rmSync(path.join(dataDir, "tools.json"));
  mkdirSync(path.join(dataDir, "tools.json/sub"), { recursive: true });
  writeFileSync(path.join(dataDir, "tools.json/sub/blocker"), "x");

  const failure = await Effect.runPromiseExit(publishPortfolio({ inputRoot: root, outputPath, dataDir }));
  assert.ok(Exit.isFailure(failure), "替换失败必须失败");
  assert.match(String(Cause.squash(failure.cause).message), /已回滚保留旧产物/);
  const db = new Database(outputPath, { readonly: true });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM muse_posts").get().c, 1, "已上位的库恢复为旧内容");
  db.close();
  assert.equal(readFileSync(path.join(dataDir, "layouts.json"), "utf8"), oldLayouts, "已上位的图鉴恢复");
  assert.deepEqual(
    readdirSync(dataDir).filter((name) => /\.bak-|\.new-/.test(name)),
    [],
    "无备份/暂存残留",
  );
  assert.ok(
    !readdirSync(path.dirname(outputPath)).some((name) => name.startsWith(".portfolio-publish-")),
    "暂存目录已清理",
  );
});

test("并发发布互斥：活锁冲突清晰失败，死锁自动接管", async (t) => {
  const root = fixtureInput(t, "lock");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "p1" }));
  const { outputPath, dataDir } = await publish(root);
  const lockPath = `${outputPath}.lock`;

  writeFileSync(lockPath, JSON.stringify({ pid: process.pid }));
  const conflict = await Effect.runPromiseExit(publishPortfolio({ inputRoot: root, outputPath, dataDir }));
  assert.ok(Exit.isFailure(conflict), "活锁持有者存在时必须失败");
  assert.match(String(Cause.squash(conflict.cause).message), /另一个发布进程正在运行（pid \d+）/);
  assert.ok(existsSync(lockPath), "冲突方不删除他人锁");

  const exited = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  writeFileSync(lockPath, JSON.stringify({ pid: exited.pid }));
  const second = await publish(root);
  assert.equal(second.summary.posts, 1, "死锁接管后发布成功");
  assert.ok(!existsSync(lockPath), "接管方发布后释放锁");
});

test("公开库超过体积上限时在替换前失败并保留旧产物", async (t) => {
  const root = fixtureInput(t, "size-guard");
  writeInputs(root);
  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "first" }));
  const { outputPath, dataDir } = await publish(root);

  seedRawDb(root, ({ stmts }) => addPost(stmts, { id: "second" }));
  writeInputs(root, { catalog: [{ ...LAYOUT_ITEM, id: "002", name: "新条目" }] });
  const failure = await Effect.runPromiseExit(
    publishPortfolio({ inputRoot: root, outputPath, dataDir, maxSnapshotBytes: 8 }),
  );
  assert.ok(Exit.isFailure(failure), "超限必须失败");
  assert.match(String(Cause.squash(failure.cause).message), /超过上限/);
  const db = new Database(outputPath, { readonly: true });
  assert.equal(db.prepare("SELECT COUNT(*) c FROM muse_posts").get().c, 1, "旧库保留");
  db.close();
  assert.match(readFileSync(path.join(dataDir, "layouts.json"), "utf8"), /"001"/, "旧图鉴保留");
});

test("布局图鉴投影物化 corrections 与 CDN 回退", (t) => {
  const root = fixtureInput(t, "layouts");
  const publicDir = path.join(root, "public");
  mkdirSync(path.join(publicDir, "layout-compositions/images/01-composition-logic"), { recursive: true });
  writeFileSync(path.join(publicDir, "layout-compositions/images/01-composition-logic/001.webp"), "img");
  const local = { ...LAYOUT_ITEM };
  const corrected = { ...LAYOUT_ITEM, id: "002", name: "v2 条目", image: "images/layout-002.png" };
  const v1Backfill = { ...LAYOUT_ITEM, id: "003" };
  const missing = { ...LAYOUT_ITEM, id: "004" };
  const entries = projectLayouts(
    [local, corrected, v1Backfill, missing],
    { "001": { v2: "002" }, "003": { v1: "100" }, "004": { missing: true } },
    publicDir,
  );
  assert.equal(entries[0].image, "/layout-compositions/images/01-composition-logic/001.webp");
  assert.equal(
    entries[1].image,
    "https://cdn.jsdelivr.net/gh/nevertoday/350-layout-compositions@main/images/layout-002.png",
  );
  assert.equal(
    entries[2].image,
    "https://cdn.jsdelivr.net/gh/nevertoday/350-layout-compositions@main/images/layout-100.png",
  );
  assert.equal(entries[3].image, null);
  assert.equal(entries[3].thumb, "/layout-compositions/thumbnails/01-composition-logic/004.webp");
});

test("缺少原始输入时发布失败并指向同步命令", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "portfolio-missing-"));
  try {
    const failure = await Effect.runPromiseExit(publishPortfolio({ inputRoot: root }));
    assert.ok(Exit.isFailure(failure));
    assert.match(String(Cause.squash(failure.cause).message), /portfolio:sync|inspora\.db/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
