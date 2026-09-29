import { z } from "zod";

// 每日动态公开投影（Supabase ai_news_public_items.content）的结构；
// 页面只消费同步进来的底层数据，不出现上游来源标识。
export type AiNewsItem = z.infer<typeof aiNewsItemContentSchema> & { selected: boolean };

// 列表页只需要这些字段；reason/score/url 仅详情页使用，列表查询做字段投影剔除。
export type AiNewsListItem = Omit<AiNewsItem, "reason" | "score" | "url">;

export const aiNewsItemContentSchema = z.object({
  category: z.string(),
  id: z.string().min(1),
  publishedAt: z.string().nullable(),
  reason: z.string(),
  score: z.number().nullable(),
  sourceName: z.string(),
  summary: z.string(),
  title: z.string().min(1),
  url: z.string().url(),
});
