import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { getAiNewsItem, getAiNewsPage } from "@/lib/ai-news";
import {
  findCurationItem,
  getCurationNeighbors,
  getCurationPage,
  getCurationTags,
  getDesignCurationPage,
  getDouyinCurationPage,
  getPromptsCurationPage,
  PROMPT_TAG,
} from "@/lib/curation";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { getOpenSourceEntry, getOpenSourceListEntries } from "@/lib/open-source";

// 页面数据的全部服务端读取集中在这组 server functions：loader 在浏览器端也会执行，
// 这里是 SQLite/Supabase 读取与客户端 bundle 之间唯一的合法边界。

const pageInput = Schema.Struct({
  limit: Schema.optional(Schema.Number),
  offset: Schema.optional(Schema.Number),
  tag: Schema.optional(Schema.NullOr(Schema.String)),
});

/** 每日动态分页（首页与 /ai-news 首屏；合并 SQLite 历史与 Supabase 增量）。 */
export const fetchAiNewsPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ offset: Schema.Number, limit: Schema.Number }))(input ?? {}))
  .handler(async ({ data }) => Effect.runPromise(getAiNewsPage(data.offset, data.limit)));

/** 每日动态单条详情。 */
export const fetchAiNewsItem = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(input))
  .handler(async ({ data }) => Effect.runPromise(getAiNewsItem(data.id)));

/** 每日关注首屏：分页 + 全部标签（TaggedCurationStream 的筛选菜单数据）。 */
export const fetchCurationFeed = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(pageInput)(input ?? {}))
  .handler(async ({ data }) =>
    Effect.runPromise(Effect.all({
      page: getCurationPage(data.offset ?? 0, data.limit ?? CURATION_PAGE_SIZE, data.tag ?? null),
      tags: getCurationTags(),
    })));

/** 设计收藏首屏分页。 */
export const fetchDesignPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ offset: Schema.Number, limit: Schema.Number }))(input ?? {}))
  .handler(async ({ data }) => Effect.runPromise(getDesignCurationPage(data.offset, data.limit)));

/** 抖音收藏首屏分页。 */
export const fetchDouyinPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ offset: Schema.Number, limit: Schema.Number }))(input ?? {}))
  .handler(async ({ data }) => Effect.runPromise(getDouyinCurationPage(data.offset, data.limit)));

/** 提示词栏目首屏：提示词子集分页 + 子集内全部标签（开放标签筛选菜单数据）。 */
export const fetchPromptsPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(pageInput)(input ?? {}))
  .handler(async ({ data }) =>
    Effect.runPromise(Effect.all({
      page: getPromptsCurationPage(data.offset ?? 0, data.limit ?? CURATION_PAGE_SIZE, data.tag ?? null),
      tags: getCurationTags(true),
    })));

/** 开源关注列表全量条目。 */
export const fetchOpenSourceEntries = createServerFn({ method: "GET" })
  .handler(() => Effect.runPromise(getOpenSourceListEntries()));

/** 开源关注单条详情（含解析文档）。 */
export const fetchOpenSourceEntry = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ slug: Schema.String }))(input))
  .handler(async ({ data }) => Effect.runPromise(getOpenSourceEntry(data.slug)));

/** 剪报详情（curation、design 与 prompts 板块共用；design 只放行 include 状态条目，
 *  prompts 只放行带「提示词」标签的条目）。
 *  条目与相邻剪报互不依赖，按 Vercel async-parallel 规则并行取回；非存在/被排除
 *  条目最多浪费一次相邻查询（有索引），换取详情视图少一串行往返。 */
export const fetchCurationEntry = createServerFn({ method: "GET" })
  .validator((input: unknown) => Schema.decodeUnknownSync(Schema.Struct({ context: Schema.Literals(["curation", "design", "prompts"]), id: Schema.String }))(input))
  .handler(async ({ data }) => {
    const { item, neighbors } = await Effect.runPromise(Effect.all(
      { item: findCurationItem(data.id), neighbors: getCurationNeighbors(data.id, data.context) },
    ));
    if (!item || (data.context === "design" && item.design?.status !== "include")) return null;
    if (data.context === "prompts" && !item.tags.includes(PROMPT_TAG)) return null;
    return { item, neighbors };
  });
