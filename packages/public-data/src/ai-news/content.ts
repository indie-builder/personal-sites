import { UrlString } from "@site/effect/schema";
import { Schema } from "effect";

// 每日动态公开投影（Supabase ai_news_public_items.content）的结构；
// 页面只消费同步进来的底层数据，不出现上游来源标识。
export type AiNewsItem = typeof aiNewsItemContentSchema.Type & { selected: boolean };

// 列表页只需要这些字段；reason/score/url 仅详情页使用，列表查询做字段投影剔除。
export type AiNewsListItem = Omit<AiNewsItem, "reason" | "score" | "url">;

export const aiNewsItemContentSchema = Schema.Struct({
  category: Schema.String,
  id: Schema.String.check(Schema.isMinLength(1)),
  publishedAt: Schema.NullOr(Schema.String),
  reason: Schema.String,
  score: Schema.NullOr(Schema.Number.check(Schema.isFinite())),
  sourceName: Schema.String,
  summary: Schema.String,
  title: Schema.String.check(Schema.isMinLength(1)),
  url: UrlString,
});
