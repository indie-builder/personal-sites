// 作品集公开读取行为测试：分页/搜索/分类语义、详情与浏览窗口、总览预览、目录投影契约。

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import { Effect } from "effect";

import { PUBLIC_SCHEMA } from "../src/portfolio/schema.mjs";
import {
  layoutEntries,
  personalSitePromo,
  portfolioProducts,
  readLayoutCategories,
  toolCategories,
} from "../src/portfolio/products.mjs";
import {
  openPortfolioDatabase,
  readMuseBrowseWindow,
  readMuseCardsPage,
  readMuseDetail,
  readMusePreviews,
  readMuseTabs,
} from "../src/portfolio/muse.mjs";

function fixtureDatabase(t) {
  const root = mkdtempSync(path.join(tmpdir(), "portfolio-read-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const filename = path.join(root, "portfolio.sqlite");
  const db = new Database(filename);
  db.exec(PUBLIC_SCHEMA);
  return { db, filename };
}

function insertPost(db, row) {
  db.prepare(
    `INSERT INTO muse_posts (id, slug, title, creator_name, category, industries, styles, colors,
      source_url, created_at, published_at, is_featured, media_count, search)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 0, ?, ?)`,
  ).run(
    row.id,
    row.slug,
    row.title,
    row.creatorName ?? null,
    row.category ?? null,
    JSON.stringify(row.industries ?? []),
    JSON.stringify(row.styles ?? []),
    row.sourceUrl ?? null,
    row.createdAt,
    row.publishedAt ?? null,
    (row.media ?? []).length,
    row.search ?? [row.title, row.category ?? "未分类"].filter(Boolean).join(" ").toLowerCase(),
  );
  for (const [index, media] of (row.media ?? []).entries()) {
    db.prepare(
      `INSERT INTO muse_media (id, post_id, position, type, src, preview_src, poster, thumb, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      media.id,
      row.id,
      media.position ?? index,
      media.type ?? "image",
      media.src ?? null,
      media.previewSrc ?? media.src ?? null,
      media.poster ?? null,
      media.thumb ?? null,
      media.width ?? null,
      media.height ?? null,
    );
  }
}

test("灵感分页：排序、分类过滤、substring 搜索与 hasMore 语义", async (t) => {
  const { db, filename } = fixtureDatabase(t);
  insertPost(db, { id: "1", slug: "a", title: "Alpha Poster", category: "Motion", createdAt: "2026-09-01", search: "alpha poster motion 动效" });
  insertPost(db, { id: "2", slug: "b", title: "Beta Board", category: "Product", createdAt: "2026-09-02", search: "beta board product 产品设计" });
  insertPost(db, { id: "3", slug: "c", title: "Gamma 动效", category: null, createdAt: "2026-09-03", search: "gamma 动效 未分类" });
  insertPost(db, { id: "4", slug: "d", title: "Delta Landing", category: "Motion", creatorName: "River", createdAt: "2026-09-04", search: "delta landing motion river 动效" });
  db.close();
  const read = openPortfolioDatabase(filename);

  const all = await Effect.runPromise(readMuseCardsPage(read, { offset: 0, limit: 2 }));
  assert.equal(all.total, 4);
  assert.ok(all.hasMore);
  assert.deepEqual(all.items.map((item) => item.slug), ["d", "c"]);
  assert.equal(all.items[0].sub, "2026-09-04");
  assert.equal(all.items[0].lead, "River");
  assert.equal(all.items[1].category, "未分类");

  const motion = await Effect.runPromise(readMuseCardsPage(read, { category: "Motion", offset: 0, limit: 10 }));
  assert.deepEqual(motion.items.map((item) => item.slug), ["d", "a"]);

  const search = await Effect.runPromise(readMuseCardsPage(read, { q: "landing", offset: 0, limit: 10 }));
  assert.deepEqual(search.items.map((item) => item.slug), ["d"]);

  const last = await Effect.runPromise(readMuseCardsPage(read, { offset: 3, limit: 2 }));
  assert.equal(last.total, 4);
  assert.ok(!last.hasMore);
  read.close();
});

test("卡片首媒体映射：视频用预览地址，图片用缩略图，无媒体回退占位尺寸", async (t) => {
  const { db, filename } = fixtureDatabase(t);
  insertPost(db, {
    id: "1",
    slug: "video-post",
    title: "视频帖",
    createdAt: "2026-09-02",
    media: [{ id: "m1", type: "video", src: "https://cdn/full.mp4", previewSrc: "https://cdn/preview.mp4", poster: "/inspora/posters/p.webp", thumb: "/inspora/posters/p.webp" }],
  });
  insertPost(db, {
    id: "2",
    slug: "image-post",
    title: "图片帖",
    createdAt: "2026-09-01",
    media: [{ id: "m2", type: "image", src: "/inspora/images/full.webp", thumb: "/inspora/thumbnails/t.webp" }],
  });
  insertPost(db, { id: "3", slug: "empty-post", title: "无媒体帖", createdAt: "2026-09-03" });
  db.close();
  const read = openPortfolioDatabase(filename);
  const page = await Effect.runPromise(readMuseCardsPage(read, { offset: 0, limit: 10 }));
  const byslug = new Map(page.items.map((item) => [item.slug, item]));
  const video = byslug.get("video-post");
  assert.equal(video.kind, "video");
  assert.equal(video.src, "https://cdn/preview.mp4");
  assert.equal(video.fullSrc, undefined);
  assert.equal(video.poster, "/inspora/posters/p.webp");
  const image = byslug.get("image-post");
  assert.equal(image.kind, "image");
  assert.equal(image.src, "/inspora/thumbnails/t.webp");
  assert.equal(image.fullSrc, "/inspora/images/full.webp");
  const empty = byslug.get("empty-post");
  assert.equal(empty.kind, "image");
  assert.equal(empty.src, "");
  assert.equal(empty.width, 4);
  read.close();
});

test("分类标签：计数降序、同数保持首现顺序、未分类置底", async (t) => {
  const { db, filename } = fixtureDatabase(t);
  insertPost(db, { id: "1", slug: "m1", title: "一", category: "Motion", createdAt: "2026-09-01" });
  insertPost(db, { id: "2", slug: "w1", title: "二", category: "Web", createdAt: "2026-09-02" });
  insertPost(db, { id: "3", slug: "m2", title: "三", category: "Motion", createdAt: "2026-09-03" });
  insertPost(db, { id: "4", slug: "u1", title: "四", category: null, createdAt: "2026-09-04" });
  insertPost(db, { id: "5", slug: "p1", title: "五", category: "Product", createdAt: "2026-09-05" });
  db.close();
  const read = openPortfolioDatabase(filename);
  const tabs = await Effect.runPromise(readMuseTabs(read));
  assert.deepEqual(tabs, [
    { name: "Motion", count: 2 },
    { name: "Product", count: 1 },
    { name: "Web", count: 1 },
    { name: "未分类", count: 1 },
  ]);
  read.close();
});

test("详情：缺失 slug 返回 null；媒体 alt 用完整媒体计数编号并过滤空地址", async (t) => {
  const { db, filename } = fixtureDatabase(t);
  insertPost(db, {
    id: "1",
    slug: "multi",
    title: "多图帖",
    createdAt: "2026-09-01",
    media: [
      { id: "a", src: "/one.webp" },
      { id: "b", src: null },
      { id: "c", src: "/three.webp" },
    ],
  });
  db.close();
  const read = openPortfolioDatabase(filename);
  const detail = await Effect.runPromise(readMuseDetail(read, "multi"));
  assert.equal(detail.media.length, 2);
  assert.equal(detail.media[0].alt, "多图帖 · 第 1 件");
  assert.equal(detail.media[1].alt, "多图帖 · 第 2 件");
  const missing = await Effect.runPromise(readMuseDetail(read, "hidden-duplicate"));
  assert.equal(missing, null);
  read.close();
});

test("浏览窗口与总览预览：同分类窗口、视频预览置前", async (t) => {
  const { db, filename } = fixtureDatabase(t);
  insertPost(db, { id: "1", slug: "first", title: "首", category: "Motion", createdAt: "2026-09-03", media: [{ id: "m1", type: "video", src: "https://cdn/v.mp4", previewSrc: "https://cdn/p.mp4", thumb: "/t1.webp" }] });
  insertPost(db, { id: "2", slug: "second", title: "次", category: "Web", createdAt: "2026-09-02", media: [{ id: "m2", thumb: "/t2.webp" }] });
  insertPost(db, { id: "3", slug: "third", title: "三", category: "Motion", createdAt: "2026-09-01", media: [{ id: "m3", thumb: "/t3.webp" }] });
  db.close();
  const read = openPortfolioDatabase(filename);
  const browse = await Effect.runPromise(readMuseBrowseWindow(read, "second"));
  assert.equal(browse.browseEntries.length, 3);
  assert.deepEqual(
    browse.entries.map((entry) => entry.href),
    ["/products/muse/second"],
  );
  assert.ok(browse.browseEntries[0].search.length > 0);

  const previews = await Effect.runPromise(readMusePreviews(read, 2));
  // 视频封面置前允许与普通封面重复（源行为）。
  assert.equal(previews.length, 3);
  assert.equal(previews[0].videoSrc, "https://cdn/p.mp4");
  assert.equal(previews[1].src, "/t1.webp");
  assert.equal(previews[2].src, "/t2.webp");
  read.close();
});

test("作品注册表与目录投影契约：七个产品、350 图鉴、8 分类 33 主题、工具目录", () => {
  assert.equal(portfolioProducts.length, 7);
  assert.deepEqual(
    portfolioProducts.map((product) => product.slug),
    [...portfolioProducts].sort((a, b) => a.date.localeCompare(b.date)).map((product) => product.slug),
  );
  for (const product of portfolioProducts) {
    assert.match(product.href, /^\/products\/[a-z-]+$/);
    assert.ok(["上线", "收录"].includes(product.dateLabel));
  }
  assert.equal(layoutEntries.length, 350);
  const categories = Effect.runSync(readLayoutCategories());
  assert.equal(categories.length, 8);
  assert.equal(categories.reduce((total, category) => total + category.subcategories.length, 0), 33);
  assert.equal(categories.reduce((total, category) => total + category.count, 0), 350);
  for (const entry of layoutEntries) {
    assert.ok(entry.image === null || entry.image.startsWith("/") || entry.image.startsWith("https://"));
    assert.ok(entry.thumb?.startsWith("/layout-compositions/thumbnails/"));
  }
  assert.ok(toolCategories.length > 0);
  for (const category of toolCategories) {
    assert.ok(typeof category.id === "string" && category.tools.length > 0);
  }
  assert.equal(personalSitePromo.website, "/");
});

test("真实投影冒烟：提交的 data/portfolio.sqlite 计数与 meta 一致且分类可见", async (t) => {
  const filename = new URL("../../../data/portfolio.sqlite", import.meta.url).pathname;
  if (!existsSync(filename)) {
    t.skip("缺少 data/portfolio.sqlite；先运行 portfolio:project");
    return;
  }
  const read = openPortfolioDatabase(filename);
  const counts = JSON.parse(read.prepare("SELECT value FROM portfolio_meta WHERE key='counts'").get().value);
  const actual = read.prepare("SELECT (SELECT COUNT(*) FROM muse_posts) AS posts, (SELECT COUNT(*) FROM muse_media) AS media").get();
  assert.equal(actual.posts, counts.posts);
  assert.equal(actual.media, counts.media);
  assert.ok(counts.posts > 9000, "公开投影应包含全部可见帖子");
  const tabs = await Effect.runPromise(readMuseTabs(read));
  assert.equal(tabs.reduce((total, tab) => total + tab.count, 0), counts.posts);
  const page = await Effect.runPromise(readMuseCardsPage(read, { offset: 0, limit: 1 }));
  assert.ok(page.items[0].href.startsWith("/products/muse/"));
  read.close();
});
