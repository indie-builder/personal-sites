import { z } from "zod";

/**
 * 公开策展投影（curation.sqlite `content_json`）的唯一结构定义：
 * zod schema 同时承担运行时校验与静态类型推导，避免手写类型与校验规则漂移。
 */
export const curationItemSchema = z.object({
  analysis: z.string().min(1),
  author: z.object({
    handle: z.string(),
    name: z.string(),
  }),
  collectedAt: z.string().datetime().nullable().default(null),
  collectedOrder: z.number().int().nonnegative().nullable().default(null),
  design: z
    .object({
      categories: z.array(z.string().min(1)).max(3),
      classifiedAt: z.string().datetime(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string().min(1)).max(4),
      reason: z.string().min(1),
      relevant: z.boolean(),
      status: z.enum(["include", "review", "exclude"]),
    })
    .nullable()
    .default(null),
  facts: z
    .object({
      version: z.number().int().positive(),
      contentType: z.enum(["original", "quote", "reply"]),
      domains: z.array(z.string()),
      hashtags: z.array(z.string()),
      linkTypes: z.array(z.string()),
      mediaTypes: z.array(z.string()),
      mentions: z.array(z.string()),
      sourceKinds: z.array(z.string()),
      tools: z.array(z.string()),
    })
    .default({
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
  id: z.string().min(1),
  links: z.array(
    z.object({
      shortUrl: z.string().url().nullable(),
      type: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  media: z.array(
    z.object({
      durationMs: z.number().int().nonnegative().nullable().default(null),
      height: z.number().int().positive().nullable(),
      previewUrl: z.string().url().nullable(),
      type: z.enum(["photo", "video", "animated_gif"]),
      url: z.string().url(),
      videoUrl: z.string().url().nullable().default(null),
      width: z.number().int().positive().nullable(),
    }),
  ),
  publishedAt: z.string().datetime().nullable(),
  quoteContext: z
    .object({
      author: z.string(),
      authorName: z.string(),
      text: z.string(),
    })
    .nullable(),
  source: z.object({
    label: z.string().min(1),
    platform: z.enum(["douyin", "x"]),
    url: z.string().url(),
  }),
  searchSignals: z
    .object({
      concepts: z.array(z.string()),
      entities: z.array(z.string()),
      problems: z.array(z.string()),
      sentiment: z.enum(["positive", "negative", "neutral", "humorous", "controversial"]),
      tools: z.array(z.string()),
      useCases: z.array(z.string()),
    })
    .nullable()
    .default(null),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
  title: z.string().min(1),
  visualFacts: z
    .object({
      interactionSignals: z.array(z.string()),
      objects: z.array(z.string()),
      ocr: z.array(z.string()),
      scenes: z.array(z.string()),
      styles: z.array(z.string()),
      tools: z.array(z.string()),
    })
    .nullable()
    .default(null),
});

export type CurationItem = z.infer<typeof curationItemSchema>;

/**
 * Fields needed by the feed; the full analysis remains detail-only.
 * 剪报簿结构在列表里同时呈现判断（title/summary）与证据（text 摘录、tags、attachments），
 * attachments 由投影在读取时从 media 与 quoteContext 归并成登记用词。
 */
export type CurationListItem = Pick<
  CurationItem,
  "author" | "collectedAt" | "design" | "id" | "media" | "publishedAt" | "source" | "summary" | "tags" | "text" | "title"
> & {
  attachments: string[];
};
