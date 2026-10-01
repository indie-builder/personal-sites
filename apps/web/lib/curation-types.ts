import { UtcDateTimeString, UrlString } from "@site/effect/schema";
import { Schema } from "effect";

/**
 * 公开策展投影（curation.sqlite `content_json`）的唯一结构定义：
 * Effect Schema 同时承担运行时校验与静态类型推导，避免手写类型与校验规则漂移。
 */
export const curationItemSchema = Schema.Struct({
  analysis: Schema.String.pipe(Schema.minLength(1)),
  author: Schema.Struct({ handle: Schema.String, name: Schema.String }),
  collectedAt: Schema.optionalWith(Schema.NullOr(UtcDateTimeString), { default: () => null }),
  collectedOrder: Schema.optionalWith(
    Schema.NullOr(Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.nonNegative())),
    { default: () => null },
  ),
  design: Schema.optionalWith(
    Schema.NullOr(
      Schema.Struct({
        categories: Schema.Array(Schema.String.pipe(Schema.minLength(1)))
          .pipe(Schema.mutable)
          .pipe(Schema.maxItems(3)),
        classifiedAt: UtcDateTimeString,
        confidence: Schema.Number.pipe(Schema.finite())
          .pipe(Schema.greaterThanOrEqualTo(0))
          .pipe(Schema.lessThanOrEqualTo(1)),
        evidence: Schema.Array(Schema.String.pipe(Schema.minLength(1)))
          .pipe(Schema.mutable)
          .pipe(Schema.maxItems(4)),
        reason: Schema.String.pipe(Schema.minLength(1)),
        relevant: Schema.Boolean,
        status: Schema.Literal("include", "exclude"),
      }),
    ),
    { default: () => null },
  ),
  facts: Schema.optionalWith(
    Schema.Struct({
      version: Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.positive()),
      contentType: Schema.Literal("original", "quote", "reply"),
      domains: Schema.Array(Schema.String).pipe(Schema.mutable),
      hashtags: Schema.Array(Schema.String).pipe(Schema.mutable),
      linkTypes: Schema.Array(Schema.String).pipe(Schema.mutable),
      mediaTypes: Schema.Array(Schema.String).pipe(Schema.mutable),
      mentions: Schema.Array(Schema.String).pipe(Schema.mutable),
      sourceKinds: Schema.Array(Schema.String).pipe(Schema.mutable),
      tools: Schema.Array(Schema.String).pipe(Schema.mutable),
    }),
    {
      default: () => ({
        version: 1,
        contentType: "original",
        domains: [],
        hashtags: [],
        linkTypes: [],
        mediaTypes: [],
        mentions: [],
        sourceKinds: [],
        tools: [],
      }),
    },
  ),
  excerptTime: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  id: Schema.String.pipe(Schema.minLength(1)),
  links: Schema.Array(
    Schema.Struct({
      shortUrl: Schema.NullOr(UrlString),
      type: Schema.String.pipe(Schema.minLength(1)),
      url: UrlString,
    }),
  ).pipe(Schema.mutable),
  media: Schema.Array(
    Schema.Struct({
      durationMs: Schema.optionalWith(
        Schema.NullOr(Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.nonNegative())),
        { default: () => null },
      ),
      height: Schema.NullOr(Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.positive())),
      previewUrl: Schema.NullOr(UrlString),
      type: Schema.Literal("photo", "video", "animated_gif"),
      url: UrlString,
      videoUrl: Schema.optionalWith(Schema.NullOr(UrlString), { default: () => null }),
      width: Schema.NullOr(Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.positive())),
    }),
  ).pipe(Schema.mutable),
  publishedAt: Schema.NullOr(UtcDateTimeString),
  quoteContext: Schema.NullOr(Schema.Struct({ author: Schema.String, authorName: Schema.String, text: Schema.String })),
  source: Schema.Struct({
    label: Schema.String.pipe(Schema.minLength(1)),
    platform: Schema.Literal("douyin", "x"),
    url: UrlString,
  }),
  searchSignals: Schema.optionalWith(
    Schema.NullOr(
      Schema.Struct({
        concepts: Schema.Array(Schema.String).pipe(Schema.mutable),
        entities: Schema.Array(Schema.String).pipe(Schema.mutable),
        problems: Schema.Array(Schema.String).pipe(Schema.mutable),
        sentiment: Schema.Literal("positive", "negative", "neutral", "humorous", "controversial"),
        tools: Schema.Array(Schema.String).pipe(Schema.mutable),
        useCases: Schema.Array(Schema.String).pipe(Schema.mutable),
      }),
    ),
    { default: () => null },
  ),
  summary: Schema.String.pipe(Schema.minLength(1)),
  tags: Schema.Array(Schema.String.pipe(Schema.minLength(1)))
    .pipe(Schema.mutable)
    .pipe(Schema.minItems(1)),
  text: Schema.String.pipe(Schema.minLength(1)),
  title: Schema.String.pipe(Schema.minLength(1)),
  visualFacts: Schema.optionalWith(
    Schema.NullOr(
      Schema.Struct({
        interactionSignals: Schema.Array(Schema.String).pipe(Schema.mutable),
        objects: Schema.Array(Schema.String).pipe(Schema.mutable),
        ocr: Schema.Array(Schema.String).pipe(Schema.mutable),
        scenes: Schema.Array(Schema.String).pipe(Schema.mutable),
        styles: Schema.Array(Schema.String).pipe(Schema.mutable),
        tools: Schema.Array(Schema.String).pipe(Schema.mutable),
      }),
    ),
    { default: () => null },
  ),
});

export type CurationItem = typeof curationItemSchema.Type;

/**
 * Fields needed by the feed; the full analysis remains detail-only.
 * 剪报簿结构在列表里同时呈现判断（title/summary）与证据（text 摘录、tags、attachments），
 * attachments 由投影在读取时从 media 与 quoteContext 归并成登记用词。
 */
export type CurationListItem = Pick<
  CurationItem,
  | "author"
  | "collectedAt"
  | "design"
  | "id"
  | "media"
  | "publishedAt"
  | "source"
  | "summary"
  | "tags"
  | "text"
  | "title"
> & {
  attachments: string[];
};
