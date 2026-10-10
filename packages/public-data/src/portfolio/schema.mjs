// 作品集公开域类型的 Effect Schema：读取边界解码投影行，发布与测试共用同一契约。

import { Schema } from "effect";

export const museMediaSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["image", "video"]),
  src: Schema.String,
  poster: Schema.NullOr(Schema.String),
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  alt: Schema.String,
});

export const museCardSchema = Schema.Struct({
  key: Schema.String,
  slug: Schema.String,
  category: Schema.String,
  lead: Schema.optional(Schema.UndefinedOr(Schema.String)),
  name: Schema.String,
  sub: Schema.String,
  href: Schema.String,
  kind: Schema.Literals(["image", "video"]),
  src: Schema.String,
  poster: Schema.UndefinedOr(Schema.String),
  fullSrc: Schema.UndefinedOr(Schema.String),
  width: Schema.Number,
  height: Schema.Number,
  mediaCount: Schema.Number,
});

export const museDetailSchema = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  creatorName: Schema.NullOr(Schema.String),
  creatorUrl: Schema.NullOr(Schema.String),
  creatorAvatar: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  industries: Schema.Array(Schema.String),
  styles: Schema.Array(Schema.String),
  sourceUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  firstThumbnail: Schema.NullOr(Schema.String),
  media: Schema.Array(museMediaSchema),
});

export const museRefSchema = Schema.Struct({
  href: Schema.String,
  title: Schema.String,
  category: Schema.String,
  search: Schema.Array(Schema.String),
});

export const museBrowseWindowSchema = Schema.Struct({
  currentHref: Schema.String,
  browseEntries: Schema.Array(museRefSchema),
  entries: Schema.Array(Schema.Struct({ href: Schema.String, title: Schema.String })),
});

export const musePreviewSchema = Schema.Struct({
  src: Schema.String,
  alt: Schema.String,
  videoSrc: Schema.optional(Schema.String),
});

export const museCategorySchema = Schema.Struct({
  name: Schema.String,
  count: Schema.Number,
});

export const musePageSchema = Schema.Struct({
  items: Schema.Array(museCardSchema),
  total: Schema.Number,
  hasMore: Schema.Boolean,
});

export const layoutEntrySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Schema.String,
  categorySlug: Schema.String,
  subcategory: Schema.String,
  subcategorySlug: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  image: Schema.NullOr(Schema.String),
  thumb: Schema.NullOr(Schema.String),
});

export const toolEntrySchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  icon: Schema.NullOr(Schema.String),
});

export const toolCategorySchema = Schema.Struct({
  id: Schema.String,
  tools: Schema.Array(toolEntrySchema),
});

export const portfolioProductSchema = Schema.Struct({
  slug: Schema.String,
  name: Schema.String,
  tagline: Schema.String,
  description: Schema.String,
  date: Schema.String,
  dateLabel: Schema.String,
  href: Schema.String,
  cover: Schema.String,
});

/** 公开库 DDL（唯一事实）：发布器建库与读取侧测试共用同一建表契约。 */
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
