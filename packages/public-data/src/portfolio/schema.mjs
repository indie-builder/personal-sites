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
  poster: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
  fullSrc: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
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
