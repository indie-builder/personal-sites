import { UtcDateTimeString, UrlString } from "@site/effect/schema";
import { Effect, Schema } from "effect";

/**
 * 公开策展投影（curation.sqlite `content_json`）的唯一结构定义：
 * Effect Schema 同时承担运行时校验与静态类型推导，避免手写类型与校验规则漂移。
 */
export const curationItemSchema = Schema.Struct({
  analysis: Schema.String.check(Schema.isMinLength(1)),
  author: Schema.Struct({ handle: Schema.String, name: Schema.String }),
  collectedAt: Schema.NullOr(UtcDateTimeString).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  collectedOrder: Schema.NullOr(
    Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0)),
  ).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  design: Schema.NullOr(
    Schema.Struct({
      categories: Schema.Array(Schema.String.check(Schema.isMinLength(1)))
        .pipe(Schema.mutable)
        .check(Schema.isMaxLength(3)),
      classifiedAt: UtcDateTimeString,
      confidence: Schema.Number.check(Schema.isFinite())
        .check(Schema.isGreaterThanOrEqualTo(0))
        .check(Schema.isLessThanOrEqualTo(1)),
      evidence: Schema.Array(Schema.String.check(Schema.isMinLength(1)))
        .pipe(Schema.mutable)
        .check(Schema.isMaxLength(4)),
      reason: Schema.String.check(Schema.isMinLength(1)),
      relevant: Schema.Boolean,
      status: Schema.Literals(["include", "exclude"]),
    }),
  ).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  facts: Schema.Struct({
    version: Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThan(0)),
    contentType: Schema.Literals(["original", "quote", "reply"]),
    domains: Schema.Array(Schema.String).pipe(Schema.mutable),
    hashtags: Schema.Array(Schema.String).pipe(Schema.mutable),
    linkTypes: Schema.Array(Schema.String).pipe(Schema.mutable),
    mediaTypes: Schema.Array(Schema.String).pipe(Schema.mutable),
    mentions: Schema.Array(Schema.String).pipe(Schema.mutable),
    sourceKinds: Schema.Array(Schema.String).pipe(Schema.mutable),
    tools: Schema.Array(Schema.String).pipe(Schema.mutable),
  }).pipe(
    Schema.withDecodingDefaultType(
      Effect.sync(() => ({
        version: 1,
        contentType: "original",
        domains: [],
        hashtags: [],
        linkTypes: [],
        mediaTypes: [],
        mentions: [],
        sourceKinds: [],
        tools: [],
      })),
    ),
  ),
  excerptTime: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  id: Schema.String.check(Schema.isMinLength(1)),
  links: Schema.Array(
    Schema.Struct({
      shortUrl: Schema.NullOr(UrlString),
      type: Schema.String.check(Schema.isMinLength(1)),
      url: UrlString,
    }),
  ).pipe(Schema.mutable),
  media: Schema.Array(
    Schema.Struct({
      durationMs: Schema.NullOr(
        Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0)),
      ).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
      height: Schema.NullOr(
        Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThan(0)),
      ),
      previewUrl: Schema.NullOr(UrlString),
      type: Schema.Literals(["photo", "video", "animated_gif"]),
      url: UrlString,
      videoUrl: Schema.NullOr(UrlString).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
      width: Schema.NullOr(
        Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThan(0)),
      ),
    }),
  ).pipe(Schema.mutable),
  publishedAt: Schema.NullOr(UtcDateTimeString),
  quoteContext: Schema.NullOr(
    Schema.Struct({ author: Schema.String, authorName: Schema.String, text: Schema.String }),
  ),
  source: Schema.Struct({
    label: Schema.String.check(Schema.isMinLength(1)),
    platform: Schema.Literals(["douyin", "x"]),
    url: UrlString,
  }),
  searchSignals: Schema.NullOr(
    Schema.Struct({
      concepts: Schema.Array(Schema.String).pipe(Schema.mutable),
      entities: Schema.Array(Schema.String).pipe(Schema.mutable),
      problems: Schema.Array(Schema.String).pipe(Schema.mutable),
      sentiment: Schema.Literals(["positive", "negative", "neutral", "humorous", "controversial"]),
      tools: Schema.Array(Schema.String).pipe(Schema.mutable),
      useCases: Schema.Array(Schema.String).pipe(Schema.mutable),
    }),
  ).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  summary: Schema.String.check(Schema.isMinLength(1)),
  tags: Schema.Array(Schema.String.check(Schema.isMinLength(1)))
    .pipe(Schema.mutable)
    .check(Schema.isMinLength(1)),
  text: Schema.String.check(Schema.isMinLength(1)),
  title: Schema.String.check(Schema.isMinLength(1)),
  visualFacts: Schema.NullOr(
    Schema.Struct({
      interactionSignals: Schema.Array(Schema.String).pipe(Schema.mutable),
      objects: Schema.Array(Schema.String).pipe(Schema.mutable),
      ocr: Schema.Array(Schema.String).pipe(Schema.mutable),
      scenes: Schema.Array(Schema.String).pipe(Schema.mutable),
      styles: Schema.Array(Schema.String).pipe(Schema.mutable),
      tools: Schema.Array(Schema.String).pipe(Schema.mutable),
    }),
  ).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
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
