// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const curationMocks = vi.hoisted(() => ({
  findCurationItem: vi.fn(),
  getCurationNeighbors: vi.fn(),
}));
// fetchCurationEntry 是 createServerFn，数据读取全部走 lib/curation；
// mock 掉实现即可在测试环境直接调用 server function 的 handler。
vi.mock("@/lib/curation", () => ({
  findCurationItem: curationMocks.findCurationItem,
  getCurationNeighbors: curationMocks.getCurationNeighbors,
  PROMPT_TAG: "提示词",
}));
// vitest 不经过 TanStack 的 vite 编译插件：真实的 createServerFn 要么走客户端
// fetch，要么依赖编译期拆出的 serverFn 桩，都无法在单测里拿到 handler 返回值。
// 这里换成透传实现：validator 与 handler 原样执行，只剥掉传输层。
vi.mock("@tanstack/react-start", () => ({
  createServerFn: (_options: unknown) => {
    let validator: ((input: unknown) => unknown) | undefined;
    let handler: (ctx: { data: unknown }) => unknown;
    const chain = {
      validator: (v: (input: unknown) => unknown) => {
        validator = v;
        return chain;
      },
      handler: (h: (ctx: { data: unknown }) => unknown) => {
        handler = h;
        return (input?: { data?: unknown }) =>
          handler({ data: validator ? validator(input?.data) : input?.data });
      },
    };
    return chain;
  },
}));

import { buildCurationEntryHead, type CurationEntryData } from "@/components/curation-entry";
import type { CurationItem } from "@/lib/curation-types";
import { SITE_URL } from "@/lib/site";
import { fetchCurationEntry } from "@/src/functions/content";

const callFetchCurationEntry = (input: { context: "curation" | "design" | "prompts"; id: string }) =>
  fetchCurationEntry({ data: input }) as Promise<CurationEntryData | null>;

const neighbors = { newer: null, older: null } as CurationEntryData["neighbors"];

function fixtureItem(overrides: Partial<CurationItem> = {}): CurationItem {
  return {
    analysis: "一段深度解析。",
    author: { handle: "example", name: "示例作者" },
    collectedAt: "2026-08-14T11:25:29.000Z",
    collectedOrder: null,
    design: null,
    excerptTime: null,
    facts: {
      contentType: "original",
      domains: [],
      hashtags: [],
      linkTypes: [],
      mediaTypes: [],
      mentions: [],
      sourceKinds: [],
      tools: [],
      version: 1,
    },
    id: "fixture-entry",
    links: [],
    media: [],
    prompt: null,
    publishedAt: null,
    quoteContext: null,
    searchSignals: null,
    source: { label: "X（@example）", platform: "x", url: "https://x.com/example/1" },
    summary: "一条公开摘要。",
    tags: ["提示词"],
    text: "原文摘录。",
    title: "示例标题",
    visualFacts: null,
    ...overrides,
  };
}

const entry = (item: CurationItem): CurationEntryData => ({ item, neighbors });

const metaContent = (head: ReturnType<typeof buildCurationEntryHead>, key: string) => {
  const found = head.meta.find(
    (meta) => ("property" in meta && meta.property === key) || ("name" in meta && meta.name === key),
  );
  return found && "content" in found ? found.content : undefined;
};

beforeEach(() => {
  curationMocks.findCurationItem.mockReset();
  curationMocks.getCurationNeighbors.mockReset().mockReturnValue(Effect.succeed(neighbors));
});

describe("fetchCurationEntry", () => {
  it("每日关注放行全部条目，相邻导航不限定板块", async () => {
    const plain = fixtureItem();
    curationMocks.findCurationItem.mockReturnValue(Effect.succeed(plain));

    await expect(callFetchCurationEntry({ context: "curation", id: plain.id })).resolves.toEqual({
      item: plain,
      neighbors,
    });
    expect(curationMocks.getCurationNeighbors).toHaveBeenCalledWith(plain.id, "curation");
  });

  it("设计收藏只放行 include 状态条目", async () => {
    const excluded = fixtureItem({
      id: "excluded-entry",
      design: {
        categories: ["布局"],
        classifiedAt: "2026-08-14T11:25:29.000Z",
        confidence: 0.9,
        evidence: ["装饰性截屏"],
        reason: "仅作参考",
        relevant: false,
        status: "exclude",
      },
    });
    curationMocks.findCurationItem.mockReturnValueOnce(Effect.succeed(excluded));
    await expect(callFetchCurationEntry({ context: "design", id: excluded.id })).resolves.toBeNull();
    // 条目与相邻剪报已并行化：被排除条目允许并发发出的相邻查询（有索引，成本一次
    // 查询换取详情视图少一串行往返），契约只要求最终结果仍为 null。
    expect(curationMocks.getCurationNeighbors).toHaveBeenCalledWith(excluded.id, "design");

    const included = fixtureItem({
      design: {
        categories: ["布局"],
        classifiedAt: "2026-08-14T11:25:29.000Z",
        confidence: 0.9,
        evidence: ["配色系统"],
        reason: "收录价值高",
        relevant: true,
        status: "include",
      },
    });
    curationMocks.findCurationItem.mockReturnValueOnce(Effect.succeed(included));
    await expect(callFetchCurationEntry({ context: "design", id: included.id })).resolves.toEqual({
      item: included,
      neighbors,
    });
    expect(curationMocks.getCurationNeighbors).toHaveBeenCalledWith(included.id, "design");
  });

  it("提示词栏目只放行带总类标签的条目，相邻导航在子集内", async () => {
    const withoutPrompt = fixtureItem({ tags: ["技能"] });
    curationMocks.findCurationItem.mockReturnValueOnce(Effect.succeed(withoutPrompt));
    await expect(callFetchCurationEntry({ context: "prompts", id: withoutPrompt.id })).resolves.toBeNull();
    expect(curationMocks.getCurationNeighbors).toHaveBeenCalledWith(withoutPrompt.id, "prompts");

    const promptItem = fixtureItem({ tags: ["提示词", "软件工程提示词"] });
    curationMocks.findCurationItem.mockReturnValueOnce(Effect.succeed(promptItem));
    await expect(callFetchCurationEntry({ context: "prompts", id: promptItem.id })).resolves.toEqual({
      item: promptItem,
      neighbors,
    });
    expect(curationMocks.getCurationNeighbors).toHaveBeenCalledWith(promptItem.id, "prompts");
  });

  it("未知条目返回 null（路由据此抛 notFound）", async () => {
    curationMocks.findCurationItem.mockReturnValue(Effect.succeed(null));
    await expect(callFetchCurationEntry({ context: "curation", id: "missing-entry-id" })).resolves.toBeNull();
  });
});

describe("buildCurationEntryHead", () => {
  it("每日关注详情 canonical 指向 /curation/<id> 并带完整分享卡片", () => {
    const head = buildCurationEntryHead({ context: "curation", entry: entry(fixtureItem()) });
    const canonicalPath = "/curation/fixture-entry";

    // sitemap 只收录 /curation 路径；两个板块的详情 canonical 都归一到它。
    // RSS 订阅标注由根布局统一提供（TanStack head links 合并不去重，页面级不再重复）。
    expect(head.links).toEqual([
      { rel: "canonical", href: `${SITE_URL}${canonicalPath}` },
    ]);
    expect(head.meta).toContainEqual({ title: "示例标题｜每日关注" });
    expect(head.meta).toContainEqual({ name: "description", content: "一条公开摘要。" });
    expect(metaContent(head, "og:title")).toBe("示例标题｜每日关注");
    expect(metaContent(head, "og:description")).toBe("一条公开摘要。");
    expect(metaContent(head, "og:type")).toBe("article");
    expect(metaContent(head, "og:url")).toBe(`${SITE_URL}${canonicalPath}`);
    expect(metaContent(head, "og:image")).toBe(`${SITE_URL}/opengraph-image`);
    expect(metaContent(head, "twitter:card")).toBe("summary_large_image");
    expect(metaContent(head, "twitter:title")).toBe("示例标题｜每日关注");
  });

  it("设计收藏详情 canonical 同样归一到 /curation/<id>，标题换成设计板块", () => {
    const included = fixtureItem({
      design: {
        categories: ["布局"],
        classifiedAt: "2026-08-14T11:25:29.000Z",
        confidence: 0.9,
        evidence: ["配色系统"],
        reason: "收录价值高",
        relevant: true,
        status: "include",
      },
    });
    const head = buildCurationEntryHead({ context: "design", entry: entry(included) });

    expect(head.links[0]).toEqual({ rel: "canonical", href: `${SITE_URL}/curation/fixture-entry` });
    expect(head.meta).toContainEqual({ title: "示例标题｜设计收藏" });
    expect(metaContent(head, "og:url")).toBe(`${SITE_URL}/curation/fixture-entry`);
    expect(metaContent(head, "og:image")).toBe(`${SITE_URL}/opengraph-image`);
  });

  it("抖音收藏条目在每日关注路径下标注抖音板块", () => {
    const douyin = fixtureItem({
      source: { label: "抖音", platform: "douyin", url: "https://www.douyin.com/video/1" },
    });
    const head = buildCurationEntryHead({ context: "curation", entry: entry(douyin) });
    expect(head.meta).toContainEqual({ title: "示例标题｜抖音收藏" });
    expect(head.links[0]).toEqual({ rel: "canonical", href: `${SITE_URL}/curation/fixture-entry` });
  });
});
