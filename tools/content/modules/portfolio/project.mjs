// 作品集公开投影：从 data/sensitive/portfolio 的离线工作数据构建唯一公共产物。
// 输出 data/portfolio.sqlite（灵感集）与 packages/public-data/src/portfolio/data/*.json（图鉴/工具目录）。
// 构建失败保留旧产物；成功后在临时目录校验并原子替换。

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { Data, Effect } from "effect";

import { io } from "@site/effect";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(MODULE_DIR, "../../../..");
export const DEFAULT_INPUT_ROOT = path.join(REPOSITORY_ROOT, "data/sensitive/portfolio");
export const PORTFOLIO_OUTPUT_PATH = path.join(REPOSITORY_ROOT, "data/portfolio.sqlite");
const PUBLIC_DATA_DIR = path.join(REPOSITORY_ROOT, "packages/public-data/src/portfolio/data");
const WEB_PUBLIC_DIR = path.join(REPOSITORY_ROOT, "apps/web/public");

export class PortfolioInputError extends Data.TaggedError("PortfolioInputError") {
  constructor(message) {
    super({ message });
  }
}

export class PortfolioParityError extends Data.TaggedError("PortfolioParityError") {
  constructor(message) {
    super({ message });
  }
}

/** 与源实现一致的可见条件：同原作依次保留 inspora、bestx、collectui，同源按 id 唯一。 */
const VISIBLE_POSTS = `(
  tweet_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM posts AS twin
    WHERE twin.tweet_id = posts.tweet_id AND (
      (CASE twin.source WHEN 'inspora' THEN 0 WHEN 'bestx' THEN 1 ELSE 2 END)
        < (CASE posts.source WHEN 'inspora' THEN 0 WHEN 'bestx' THEN 1 ELSE 2 END)
      OR (twin.source = posts.source AND twin.id < posts.id)
    )
  )
)`;

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mediaUrl(publicDir, localPath, upstream) {
  if (localPath && existsSync(path.join(publicDir, localPath))) return localPath;
  return upstream;
}

/** 视频轻量预览端口（源 videoPreviewUrl）：解析 raw_json.videoPreview 并按体积/分辨率取舍。 */
export function videoPreviewUrl(row, src) {
  if (row.type !== "video" || !row.raw_json) return src;
  let record;
  try {
    record = JSON.parse(row.raw_json);
  } catch {
    return src;
  }
  if (!record || typeof record !== "object" || record.id !== row.id) return src;
  const preview = record.videoPreview;
  if (
    !preview ||
    typeof preview !== "object" ||
    typeof preview.url !== "string" ||
    !preview.url.startsWith("https://")
  ) {
    return src;
  }
  const smallerResolution =
    preview.width > 0 &&
    preview.height > 0 &&
    record.width > 0 &&
    record.height > 0 &&
    preview.width * preview.height < record.width * record.height;
  if (preview.bytes > 0 && record.sizeBytes > 0 && preview.bytes >= record.sizeBytes && !smallerResolution) {
    return src;
  }
  return preview.url;
}

const CATEGORY_LABELS = {
  构图逻辑: "构图",
  视觉原则与阅读模式: "视觉原则",
  "平面、出版与广告": "平面与出版",
  "字体、网格与东亚文字": "字体与网格",
  "网页与 UI": "网页与 UI",
  影视画面构图: "影视构图",
  中国传统构图: "传统构图",
  演示文稿页面: "演示文稿",
  Motion: "动效",
  Product: "产品设计",
  Web: "网页",
  Illustration: "插画",
  Branding: "品牌",
  Print: "平面",
  "3D": "三维",
  Inspiration: "灵感",
  "AI Code": "AI 编程",
  Components: "组件",
  "Web Utility": "网页工具",
  "Desktop Utility": "桌面工具",
  "Video & Capture": "视频与录制",
  Whiteboard: "白板",
  Organization: "组织",
  Fonts: "字体",
  Visual: "视觉",
  Interface: "界面",
  Audio: "音频",
  Volumetric: "体积捕捉",
  glTF: "glTF",
  "Digital Fashion": "数字时尚",
  Research: "研究",
  Browser: "浏览器",
  Emoji: "表情",
};
const categoryLabel = (name) => CATEGORY_LABELS[name] ?? name;

function museSearchColumn(post) {
  const keywords = [post.category, ...parseJsonArray(post.industries), ...parseJsonArray(post.styles)]
    .filter(Boolean)
    .join(" ");
  const cardCategory = post.category ?? "未分类";
  return [post.title, post.creator_name ?? "", keywords, categoryLabel(cardCategory)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export const PUBLIC_SCHEMA = `
  PRAGMA journal_mode = DELETE;
  CREATE TABLE muse_posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    creator_name TEXT,
    creator_url TEXT,
    creator_avatar TEXT,
    description TEXT,
    category TEXT,
    industries TEXT NOT NULL,
    colors TEXT NOT NULL,
    styles TEXT NOT NULL,
    source_url TEXT,
    created_at TEXT NOT NULL,
    published_at TEXT,
    is_featured INTEGER NOT NULL,
    media_count INTEGER NOT NULL,
    search TEXT NOT NULL
  ) STRICT;
  CREATE INDEX idx_muse_posts_created ON muse_posts(created_at DESC);
  CREATE TABLE muse_media (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES muse_posts(id),
    position INTEGER NOT NULL,
    type TEXT NOT NULL,
    src TEXT,
    preview_src TEXT,
    poster TEXT,
    thumb TEXT,
    width INTEGER,
    height INTEGER,
    UNIQUE(post_id, position)
  ) STRICT;
  CREATE INDEX idx_muse_media_post ON muse_media(post_id, position);
  CREATE TABLE portfolio_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
`;

const MUSE_SCHEMA_STATEMENTS = new Set([
  "CREATE TABLE muse_posts",
  "CREATE INDEX idx_muse_posts_created",
  "CREATE TABLE muse_media",
  "CREATE INDEX idx_muse_media_post",
  "CREATE TABLE portfolio_meta",
]);

function buildMuseProjection(rawDb, outputDb, publicDir) {
  const posts = rawDb
    .prepare(
      `SELECT id, slug, title, creator_name, creator_url, creator_avatar, description, category,
        industries, colors, styles, source_url, created_at, published_at, is_featured
      FROM posts WHERE ${VISIBLE_POSTS}`,
    )
    .all();
  const mediaByPost = new Map();
  for (const media of rawDb.prepare("SELECT * FROM media ORDER BY post_id, position").all()) {
    const list = mediaByPost.get(media.post_id) ?? [];
    list.push(media);
    mediaByPost.set(media.post_id, list);
  }
  const insertPost = outputDb.prepare(`
    INSERT INTO muse_posts (id, slug, title, creator_name, creator_url, creator_avatar, description,
      category, industries, colors, styles, source_url, created_at, published_at, is_featured,
      media_count, search)
    VALUES (@id, @slug, @title, @creator_name, @creator_url, @creator_avatar, @description,
      @category, @industries, @colors, @styles, @source_url, @created_at, @published_at,
      @is_featured, @media_count, @search)
  `);
  const insertMedia = outputDb.prepare(`
    INSERT INTO muse_media (id, post_id, position, type, src, preview_src, poster, thumb, width, height)
    VALUES (@id, @post_id, @position, @type, @src, @preview_src, @poster, @thumb, @width, @height)
  `);
  let mediaTotal = 0;
  outputDb.transaction(() => {
    for (const post of posts) {
      const media = mediaByPost.get(post.id) ?? [];
      insertPost.run({
        ...post,
        // inspora 头像是本地 public 路径；bestx 头像是 https 直链，本地缺失时按原链保留
        creator_avatar: mediaUrl(
          publicDir,
          post.creator_avatar,
          post.creator_avatar?.startsWith("https://") ? post.creator_avatar : null,
        ),
        industries: post.industries ?? "[]",
        colors: post.colors ?? "[]",
        styles: post.styles ?? "[]",
        is_featured: post.is_featured ? 1 : 0,
        media_count: media.length,
        search: museSearchColumn(post),
      });
      for (const row of media) {
        const src = mediaUrl(publicDir, row.local_path, row.url);
        insertMedia.run({
          id: row.id,
          post_id: row.post_id,
          position: row.position,
          type: row.type === "video" ? "video" : "image",
          src,
          preview_src: videoPreviewUrl(row, src),
          poster: mediaUrl(publicDir, row.local_poster_path, row.poster_url),
          thumb: mediaUrl(publicDir, row.local_thumb_path, row.poster_url ?? row.url),
          width: row.width ?? null,
          height: row.height ?? null,
        });
        mediaTotal += 1;
      }
    }
  })();
  return { posts: posts.length, media: mediaTotal };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    return Effect.fail(new PortfolioParityError(`${label} 不一致：投影 ${actual}，源 ${expected}`));
  }
  return Effect.void;
}

/** 与源读取语义逐项对照：数量、顺序、分类计数、媒体与首媒体、隐藏缺失、预览值。 */
export function verifyMuseParity(rawDb, outputDb, publicDir) {
  return Effect.gen(function* () {
    const visibleCount = rawDb.prepare(`SELECT COUNT(*) AS count FROM posts WHERE ${VISIBLE_POSTS}`).get().count;
    const visibleMediaCount = rawDb
      .prepare(`SELECT COUNT(*) AS count FROM media WHERE post_id IN (SELECT id FROM posts WHERE ${VISIBLE_POSTS})`)
      .get().count;
    yield* assertEqual(
      outputDb.prepare("SELECT COUNT(*) AS count FROM muse_posts").get().count,
      visibleCount,
      "可见帖子数",
    );
    yield* assertEqual(
      outputDb.prepare("SELECT COUNT(*) AS count FROM muse_media").get().count,
      visibleMediaCount,
      "可见媒体数",
    );

    const sourceSlugs = rawDb
      .prepare(`SELECT slug FROM posts WHERE ${VISIBLE_POSTS} ORDER BY created_at DESC`)
      .all()
      .map((row) => row.slug);
    const outputSlugs = outputDb
      .prepare("SELECT slug FROM muse_posts ORDER BY created_at DESC")
      .all()
      .map((row) => row.slug);
    if (sourceSlugs.length !== outputSlugs.length || sourceSlugs.some((slug, index) => slug !== outputSlugs[index])) {
      return yield* Effect.fail(new PortfolioParityError("slug 顺序与源可见序列不一致"));
    }

    const sourceMediaCounts = rawDb
      .prepare(
        `SELECT posts.slug, (SELECT COUNT(*) FROM media WHERE post_id = posts.id) AS count
         FROM posts WHERE ${VISIBLE_POSTS}`,
      )
      .all();
    for (const { slug, count } of sourceMediaCounts) {
      const projected = outputDb.prepare("SELECT media_count FROM muse_posts WHERE slug = ?").get(slug);
      if (!projected || projected.media_count !== count) {
        return yield* Effect.fail(new PortfolioParityError(`帖子 ${slug} 媒体计数不一致`));
      }
    }

    const sourceFirstMedia = rawDb
      .prepare(
        `SELECT posts.slug, media.id AS first_id FROM posts
         JOIN media ON media.rowid = (
           SELECT rowid FROM media WHERE post_id = posts.id ORDER BY position LIMIT 1
         )
         WHERE ${VISIBLE_POSTS}`,
      )
      .all();
    for (const { slug, first_id: firstId } of sourceFirstMedia) {
      const projected = outputDb
        .prepare(
          `SELECT m.id FROM muse_posts p JOIN muse_media m ON m.id = (
            SELECT id FROM muse_media WHERE post_id = p.id ORDER BY position LIMIT 1
          ) WHERE p.slug = ?`,
        )
        .get(slug);
      if (!projected || projected.id !== firstId) {
        return yield* Effect.fail(new PortfolioParityError(`帖子 ${slug} 首媒体不一致`));
      }
    }

    const sourceTabs = new Map();
    for (const row of rawDb
      .prepare(
        `SELECT COALESCE(category, '未分类') AS category FROM posts WHERE ${VISIBLE_POSTS} ORDER BY created_at DESC`,
      )
      .all()) {
      sourceTabs.set(row.category, (sourceTabs.get(row.category) ?? 0) + 1);
    }
    const outputTabs = new Map(
      outputDb
        .prepare("SELECT COALESCE(category, '未分类') AS category, COUNT(*) AS count FROM muse_posts GROUP BY 1")
        .all()
        .map((row) => [row.category, row.count]),
    );
    if (
      sourceTabs.size !== outputTabs.size ||
      [...sourceTabs].some(([name, count]) => outputTabs.get(name) !== count)
    ) {
      return yield* Effect.fail(new PortfolioParityError("分类计数不一致"));
    }

    const hiddenSlugs = rawDb
      .prepare(`SELECT slug FROM posts WHERE NOT (${VISIBLE_POSTS})`)
      .all()
      .map((row) => row.slug);
    const hiddenPresent = outputDb
      .prepare("SELECT COUNT(*) AS count FROM muse_posts WHERE slug IN (SELECT value FROM json_each(?))")
      .get(JSON.stringify(hiddenSlugs)).count;
    yield* assertEqual(hiddenPresent, 0, "隐藏帖子出现在投影");

    for (const row of rawDb
      .prepare(
        `SELECT media.* FROM media WHERE post_id IN (SELECT id FROM posts WHERE ${VISIBLE_POSTS}) AND type = 'video'`,
      )
      .all()) {
      const projected = outputDb.prepare("SELECT src, preview_src FROM muse_media WHERE id = ?").get(row.id);
      if (!projected) return yield* Effect.fail(new PortfolioParityError(`媒体 ${row.id} 缺失`));
      const src = mediaUrl(publicDir, row.local_path, row.url);
      if (projected.src !== src) {
        return yield* Effect.fail(new PortfolioParityError(`媒体 ${row.id} src 不一致`));
      }
      if (projected.preview_src !== videoPreviewUrl(row, src)) {
        return yield* Effect.fail(new PortfolioParityError(`媒体 ${row.id} 预览地址不一致`));
      }
    }

    const statements = outputDb
      .prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL")
      .all()
      .map((row) => row.sql.replace(/\s+/g, " ").trim());
    const allowed = [...MUSE_SCHEMA_STATEMENTS].map((prefix) => prefix.replace(/\s+/g, " "));
    const unexpected = statements.filter((statement) => !allowed.some((prefix) => statement.startsWith(prefix)));
    if (unexpected.length > 0) {
      return yield* Effect.fail(new PortfolioParityError(`出现未批准的表/索引：${unexpected.join("; ")}`));
    }
    const postColumns = outputDb.prepare("PRAGMA table_info(muse_posts)").all().map((row) => row.name);
    for (const forbidden of ["raw_json", "enriched_at", "synced_at", "source", "tweet_id"]) {
      if (postColumns.includes(forbidden)) {
        return yield* Effect.fail(new PortfolioParityError(`muse_posts 含内部列 ${forbidden}`));
      }
    }
    const mediaColumns = outputDb.prepare("PRAGMA table_info(muse_media)").all().map((row) => row.name);
    for (const forbidden of [
      "raw_json",
      "size_bytes",
      "local_path",
      "local_poster_path",
      "local_thumb_path",
      "url",
      "poster_url",
    ]) {
      if (mediaColumns.includes(forbidden)) {
        return yield* Effect.fail(new PortfolioParityError(`muse_media 含内部列 ${forbidden}`));
      }
    }
    return { posts: visibleCount, media: visibleMediaCount, hidden: hiddenSlugs.length };
  });
}

const UPSTREAM_CDN = "https://cdn.jsdelivr.net/gh/nevertoday/350-layout-compositions@main/";

function resolveUpstreamImage(item, byId, corrections) {
  const correction = corrections[item.id];
  if (!correction) return item.image;
  if (correction.missing) return null;
  if (correction.v1) return `images/layout-${correction.v1}.png`;
  const source = byId.get(correction.v2);
  if (!source) return null;
  return source.image;
}

/** 布局图鉴投影：把本地 WebP 存在性与 corrections 物化成最终图片地址。 */
export function projectLayouts(catalog, corrections, publicDir) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  return catalog.map((item) => {
    const local = `/layout-compositions/images/${item.category_slug}/${item.id}.webp`;
    const hasLocal = existsSync(path.join(publicDir, local));
    const upstreamPath = resolveUpstreamImage(item, byId, corrections);
    const image = hasLocal ? local : upstreamPath ? `${UPSTREAM_CDN}${encodeURI(upstreamPath)}` : null;
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      cat: item.category_slug,
      sub: item.subcategory,
      subSlug: item.subcategory_slug,
      width: item.width,
      height: item.height,
      image,
      thumb: `/layout-compositions/thumbnails/${item.category_slug}/${item.id}.webp`,
    };
  });
}

function writeJsonIfChanged(destination, value) {
  const content = `${JSON.stringify(value, null, 1)}\n`;
  return io("portfolio.write-json", async () => {
    const previous = await readFile(destination, "utf8").catch(() => "");
    if (previous !== content) await writeFile(destination, content, "utf8");
    return destination;
  });
}

/**
 * 唯一发布入口：读取离线输入，构建临时库与目录投影，校验后原子替换公共产物。
 * 输入只读；任何失败保留旧产物。
 */
export function publishPortfolio(options = {}) {
  const inputRoot = options.inputRoot ?? DEFAULT_INPUT_ROOT;
  const publicDir = options.publicDir ?? WEB_PUBLIC_DIR;
  const outputPath = options.outputPath ?? PORTFOLIO_OUTPUT_PATH;
  const dataDir = options.dataDir ?? PUBLIC_DATA_DIR;
  return Effect.scoped(Effect.gen(function* () {
    const rawDbPath = path.join(inputRoot, "inspora.db");
    if (!existsSync(rawDbPath)) {
      return yield* Effect.fail(
        new PortfolioInputError(`缺少输入 ${rawDbPath}；先运行 portfolio:sync 同步离线数据。`),
      );
    }
    const catalog = JSON.parse(yield* io("portfolio.read-layouts", () => readFile(path.join(inputRoot, "catalog.json"), "utf8")));
    const corrections = JSON.parse(
      yield* io("portfolio.read-corrections", () => readFile(path.join(inputRoot, "corrections.json"), "utf8")),
    );
    const tools = JSON.parse(
      yield* io("portfolio.read-tools", () => readFile(path.join(inputRoot, "design-engineer-tools/catalog.json"), "utf8")),
    );
    if (
      !Array.isArray(catalog) ||
      catalog.length === 0 ||
      !catalog.every((item) => typeof item?.id === "string" && typeof item?.image === "string")
    ) {
      return yield* Effect.fail(
        new PortfolioInputError(`布局图鉴目录结构异常：${Array.isArray(catalog) ? catalog.length : "非数组"}`),
      );
    }

    const layouts = projectLayouts(catalog, corrections, publicDir);
    const layoutsMissing = layouts.filter((item) => item.image === null).length;
    yield* io("portfolio.mkdir", () => mkdir(dataDir, { recursive: true }));
    yield* writeJsonIfChanged(path.join(dataDir, "layouts.json"), layouts);
    yield* writeJsonIfChanged(path.join(dataDir, "tools.json"), tools);

    const staging = yield* Effect.acquireRelease(
      io("portfolio.mkdtemp", () => mkdtemp(path.join(tmpdir(), "portfolio-project-"))),
      (directory) => io("portfolio.cleanup", () => rm(directory, { recursive: true, force: true })).pipe(Effect.ignore),
    );
    const temporaryDb = path.join(staging, "portfolio.sqlite");
    const summary = yield* io("portfolio.build-db", () => {
      const rawDb = new Database(rawDbPath, { readonly: true, fileMustExist: true });
      try {
        const outputDb = new Database(temporaryDb);
        try {
          outputDb.exec(PUBLIC_SCHEMA);
          const counts = buildMuseProjection(rawDb, outputDb, publicDir);
          outputDb.pragma("foreign_keys = ON");
          const violations = outputDb.pragma("foreign_key_check", { simple: true });
          if (violations) throw new Error(`外键校验失败：${JSON.stringify(violations)}`);
          const check = outputDb.pragma("integrity_check", { simple: true });
          if (check !== "ok") throw new Error(`integrity_check：${check}`);
          return counts;
        } finally {
          outputDb.close();
        }
      } finally {
        rawDb.close();
      }
    });

    const parity = yield* Effect.acquireRelease(
      io("portfolio.open-verify", () => {
        const rawDb = new Database(rawDbPath, { readonly: true, fileMustExist: true });
        const outputDb = new Database(temporaryDb, { readonly: true, fileMustExist: true });
        return { rawDb, outputDb };
      }),
      (dbs) =>
        io("portfolio.close-verify", () => {
          dbs.rawDb.close();
          dbs.outputDb.close();
        }),
    ).pipe(Effect.andThen((dbs) => verifyMuseParity(dbs.rawDb, dbs.outputDb, publicDir)));

    const meta = {
      schema: 1,
      generated_at: new Date().toISOString(),
      counts: { posts: parity.posts, media: parity.media, hidden_dropped: parity.hidden },
      layouts_count: layouts.length,
      layouts_missing: layoutsMissing,
    };
    yield* io("portfolio.write-meta", () => {
      const outputDb = new Database(temporaryDb);
      try {
        const insert = outputDb.prepare("INSERT OR REPLACE INTO portfolio_meta (key, value) VALUES (?, ?)");
        outputDb.transaction(() => {
          for (const [key, value] of Object.entries(meta)) insert.run(key, JSON.stringify(value));
        })();
        outputDb.exec("VACUUM");
      } finally {
        outputDb.close();
      }
    });
    yield* io("portfolio.publish-db", () => rename(temporaryDb, outputPath));
    return {
      database: outputPath,
      posts: parity.posts,
      media: parity.media,
      hiddenDropped: parity.hidden,
      built: summary,
      layouts: layouts.length,
      layoutsMissing,
      tools: tools.categories.reduce((total, category) => total + category.tools.length, 0),
    };
  }));
}
