// 灵感集（Muse）公开读取：查 data/portfolio.sqlite 的 muse_posts / muse_media。
// 去重与媒体地址在离线投影时物化；这里只读公开列，不做文件系统探测。

import Database from "better-sqlite3";
import { existsSync } from "node:fs";

import { attempt } from "@site/effect";
import { Schema } from "effect";

import { categoryLabel } from "./labels.mjs";
import {
  museBrowseWindowSchema,
  museCategorySchema,
  museDetailSchema,
  musePageSchema,
  musePreviewSchema,
} from "./schema.mjs";

export const PORTFOLIO_DATABASE_FILENAME = "portfolio.sqlite";

export function openPortfolioDatabase(filename = PORTFOLIO_DATABASE_FILENAME, { fileMustExist = true } = {}) {
  if (fileMustExist && !existsSync(filename)) {
    throw new Error(`缺少 ${filename}；请先运行作品集公开投影（portfolio:project）。`);
  }
  return new Database(filename, { fileMustExist, readonly: true });
}

const CARD_SELECT = `
  SELECT p.slug, p.title, p.creator_name, p.category, p.created_at, p.media_count,
    m.type AS first_type, m.src AS first_src, m.preview_src AS first_preview_src,
    m.poster AS first_poster, m.thumb AS first_thumb, m.width AS first_width, m.height AS first_height
  FROM muse_posts AS p
  LEFT JOIN muse_media AS m ON m.id = (
    SELECT id FROM muse_media WHERE post_id = p.id ORDER BY position LIMIT 1
  )`;

function cardWhere({ q, category }) {
  const clauses = [];
  const params = {};
  const query = q.trim().toLowerCase();
  if (query) {
    clauses.push("instr(p.search, @query) > 0");
    params.query = query;
  }
  if (category && category !== "全部") {
    clauses.push("COALESCE(p.category, '未分类') = @category");
    params.category = category;
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

function toCard(row) {
  const hasFirst = row.first_type !== null;
  const kind = hasFirst && row.first_type === "video" ? "video" : "image";
  const src = hasFirst
    ? kind === "video"
      ? (row.first_preview_src ?? row.first_src)
      : (row.first_thumb ?? row.first_src)
    : "";
  return {
    key: row.slug,
    slug: row.slug,
    category: row.category ?? "未分类",
    lead: row.creator_name ?? undefined,
    name: row.title,
    sub: String(row.created_at).slice(0, 10),
    href: `/products/muse/${row.slug}`,
    kind,
    src: src ?? "",
    poster: hasFirst ? (row.first_poster ?? row.first_thumb) : undefined,
    fullSrc: hasFirst && kind === "image" ? (row.first_src ?? row.first_thumb) : undefined,
    width: hasFirst ? (row.first_width ?? 4) : 4,
    height: hasFirst ? (row.first_height ?? 3) : 3,
    mediaCount: row.media_count,
  };
}

/** 分类标签：按全部条目计数，同数保持首现顺序，「未分类」置底。 */
export function readMuseTabs(db) {
  return attempt("portfolio.muse.tabs", () => {
    const counts = new Map();
    for (const row of db
      .prepare("SELECT COALESCE(category, '未分类') AS category FROM muse_posts ORDER BY created_at DESC")
      .iterate()) {
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    }
    const uncategorized = counts.get("未分类");
    counts.delete("未分类");
    const tabs = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    if (uncategorized) tabs.push({ name: "未分类", count: uncategorized });
    return Schema.decodeUnknownSync(Schema.Array(museCategorySchema))(tabs);
  });
}

/** 灵感网格分页：与源实现一致的服务端筛选（substring 搜索 + 分类），返回有界页。 */
export function readMuseCardsPage(db, { q = "", category = "全部", offset = 0, limit = 24 } = {}) {
  return attempt("portfolio.muse.page", () => {
    const { where, params } = cardWhere({ q, category });
    const total = db.prepare(`SELECT COUNT(*) AS count FROM muse_posts AS p${where}`).get(params).count;
    const rows = db
      .prepare(`${CARD_SELECT}${where} ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });
    return Schema.decodeUnknownSync(musePageSchema)({
      items: rows.map(toCard),
      total,
      hasMore: offset + limit < total,
    });
  });
}

/** 详情：隐藏（去重淘汰）条目自然缺失，返回 null 由路由 404。 */
export function readMuseDetail(db, slug) {
  return attempt("portfolio.muse.detail", () => {
    const post = db
      .prepare(`
        SELECT id, slug, title, creator_name, creator_url, creator_avatar, description,
          category, industries, styles, source_url, created_at, published_at
        FROM muse_posts WHERE slug = ?
      `)
      .get(slug);
    if (!post) return null;
    const rows = db
      .prepare("SELECT id, type, src, poster, width, height FROM muse_media WHERE post_id = ? ORDER BY position")
      .all(post.id);
    const media = rows.filter((row) => row.src);
    const detail = {
      slug: post.slug,
      title: post.title,
      creatorName: post.creator_name,
      creatorUrl: post.creator_url,
      creatorAvatar: post.creator_avatar,
      description: post.description,
      category: post.category,
      industries: JSON.parse(post.industries ?? "[]"),
      styles: JSON.parse(post.styles ?? "[]"),
      sourceUrl: post.source_url,
      createdAt: post.created_at,
      publishedAt: post.published_at,
      media: media.map((row, index) => ({
        id: row.id,
        type: row.type === "video" ? "video" : "image",
        src: row.src,
        poster: row.poster ?? null,
        width: row.width,
        height: row.height,
        alt: rows.length > 1 ? `${post.title} · 第 ${index + 1} 件` : post.title,
      })),
    };
    return Schema.decodeUnknownSync(museDetailSchema)(detail);
  });
}

const REF_COLUMNS = "slug, title, creator_name, category, industries, styles";

function toRef(row) {
  return {
    slug: row.slug,
    title: row.title,
    creatorName: row.creator_name,
    category: row.category,
    industries: JSON.parse(row.industries ?? "[]"),
    styles: JSON.parse(row.styles ?? "[]"),
  };
}

const BROWSE_WINDOW = 240;

function windowed(entries, slug) {
  const index = entries.findIndex((entry) => entry.slug === slug);
  if (index < 0) return entries.slice(0, BROWSE_WINDOW);
  const size = BROWSE_WINDOW * 2 + 1;
  if (entries.length <= size) return entries;
  const start = Math.max(0, Math.min(index - BROWSE_WINDOW, entries.length - size));
  return entries.slice(start, start + size);
}

/** 详情浏览导航：全量窗口 ±240 条与同分类窗口，控制在有界负载内。 */
export function readMuseBrowseWindow(db, slug) {
  return attempt("portfolio.muse.browse", () => {
    const current = db.prepare("SELECT slug, category FROM muse_posts WHERE slug = ?").get(slug);
    if (!current) return null;
    const all = windowed(
      db.prepare(`SELECT ${REF_COLUMNS} FROM muse_posts ORDER BY created_at DESC`).all().map(toRef),
      slug,
    );
    const sameCategory = windowed(
      db
        .prepare(
          `SELECT ${REF_COLUMNS} FROM muse_posts WHERE (category IS NULL OR category = ?) ORDER BY created_at DESC`,
        )
        .all(current.category)
        .map(toRef),
      slug,
    );
    const browse = {
      currentHref: `/products/muse/${slug}`,
      browseEntries: all.map((entry) => ({
        href: `/products/muse/${entry.slug}`,
        title: entry.title,
        category: entry.category ?? "未分类",
        search: [
          entry.creatorName ?? "",
          [entry.category, ...entry.industries, ...entry.styles].filter(Boolean).join(" "),
          categoryLabel(entry.category ?? "未分类"),
        ],
      })),
      entries: sameCategory.map((entry) => ({
        href: `/products/muse/${entry.slug}`,
        title: entry.title,
      })),
    };
    return Schema.decodeUnknownSync(museBrowseWindowSchema)(browse);
  });
}

/** 作品集总览的灵感预览：前 limit 个首媒体封面，另将第一个可播放的首媒体视频置前。 */
export function readMusePreviews(db, limit = 3) {
  return attempt("portfolio.muse.previews", () => {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("Invalid preview limit");
    const firstMediaJoin = `
      FROM muse_posts AS p
      JOIN muse_media AS m ON m.id = (
        SELECT id FROM muse_media WHERE post_id = p.id ORDER BY position LIMIT 1
      )`;
    const previews = [];
    if (limit > 0) {
      for (const row of db
        .prepare(
          `SELECT p.title, m.thumb, m.poster${firstMediaJoin}
           WHERE (m.thumb IS NOT NULL OR m.poster IS NOT NULL) ORDER BY p.created_at DESC LIMIT ?`,
        )
        .iterate(limit)) {
        previews.push({ src: row.thumb ?? row.poster, alt: row.title });
      }
    }
    const video = db
      .prepare(
        `SELECT p.title, m.src, m.preview_src, m.poster, m.thumb${firstMediaJoin}
         WHERE m.type = 'video' AND m.src IS NOT NULL ORDER BY p.created_at DESC LIMIT 1`,
      )
      .get();
    if (video) {
      previews.unshift({
        src: video.thumb ?? video.poster ?? "",
        alt: video.title,
        videoSrc: video.preview_src ?? video.src,
      });
    }
    return Schema.decodeUnknownSync(Schema.Array(musePreviewSchema))(previews);
  });
}

/** 公开投影统计：测试与发布校验用。 */
export function readPortfolioCounts(db) {
  return attempt("portfolio.counts", () => {
    const posts = db.prepare("SELECT COUNT(*) AS count FROM muse_posts").get().count;
    const media = db.prepare("SELECT COUNT(*) AS count FROM muse_media").get().count;
    const layouts = db.prepare("SELECT value FROM portfolio_meta WHERE key = 'layouts_count'").get();
    return { posts, media, layouts: layouts ? Number(layouts.value) : null };
  });
}
