import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
const { getCurationNeighbors, getCurationPage, getCurationTags, getPromptsCurationPage, PROMPT_TAG } = await import("../lib/curation");
const { Route } = await import("../src/routes/api/prompts");
// vitest 不经过 TanStack 的 vite 插件：server handlers 挂在 route options 上。
const GET = (Route.options.server!.handlers as { GET: (ctx: { request: Request }) => Response | Promise<Response> }).GET;

// 集成测试直接读随仓库打包的公开投影 data/curation.sqlite。
describe("prompts curation section", () => {
  it("只在提示词子集内统计标签，且子集外的主题不出现", async () => {
    const tags = await Effect.runPromise(getCurationTags(true));
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.map(({ tag }) => tag)).not.toContain(PROMPT_TAG);
    // 每日关注的全库标签包含提示词子集之外的标签；提示词菜单只数子集。
    const allTags = await Effect.runPromise(getCurationTags());
    for (const { tag, count } of tags) {
      expect(allTags.find((entry) => entry.tag === tag)?.count).toBeGreaterThanOrEqual(count);
    }
    expect(tags.some(({ tag, count }) => allTags.find((entry) => entry.tag === tag)!.count > count)).toBe(true);
  });

  it("子集计数与任意标签的交集分页一致", async () => {
    const tags = await Effect.runPromise(getCurationTags(true));
    const representative = tags[0];
    expect(representative.count).toBeGreaterThan(20);
    const full = await Effect.runPromise(getPromptsCurationPage(0, 10_000, representative.tag));
    expect(full.items).toHaveLength(representative.count);
    expect(full.items[0].id).toBe(representative.headId);
    expect(full.items.every((item) => item.tags.includes(PROMPT_TAG) && item.tags.includes(representative.tag))).toBe(true);
    // 同一标签在每日关注里还覆盖非提示词条目；提示词交集必须把它们排除。
    const outside = await Effect.runPromise(getCurationPage(0, 10_000, representative.tag));
    expect(outside.items.length).toBeGreaterThan(representative.count);

    const first = await Effect.runPromise(getPromptsCurationPage(0, 20, representative.tag));
    const second = await Effect.runPromise(getPromptsCurationPage(20, 20, representative.tag));
    expect(first.hasMore).toBe(representative.count > 20);
    expect([...first.items, ...second.items]).toEqual(full.items.slice(0, 40));
  });

  it("全量分页只含带总类标签的条目，未标注条目不会漏进来", async () => {
    const page = await Effect.runPromise(getPromptsCurationPage(0, 10_000));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.source.platform === "x" && item.tags.includes(PROMPT_TAG))).toBe(true);
    const promptIds = new Set(page.items.map((item) => item.id));
    const outside = await Effect.runPromise(getCurationPage(0, 50));
    expect(outside.items.some((item) => !promptIds.has(item.id) && !item.tags.includes(PROMPT_TAG))).toBe(true);
  });

  it("相邻导航留在提示词子集内", async () => {
    const full = await Effect.runPromise(getPromptsCurationPage(0, 10_000));
    const promptIds = new Set(full.items.map((item) => item.id));
    // 全量读很贵：取首尾与一个中间条目作代表。
    for (const item of [full.items[0], full.items[Math.floor(full.items.length / 2)], full.items.at(-1)!]) {
      const neighbors = await Effect.runPromise(getCurationNeighbors(item.id, "prompts"));
      for (const neighbor of [neighbors.newer, neighbors.older]) {
        if (neighbor) expect(promptIds.has(neighbor.id)).toBe(true);
      }
    }
  });

  it("/api/prompts 复用分页与标签校验，并保留公开缓存头", async () => {
    const response = await GET({ request: new Request(`http://localhost/api/prompts?tag=${encodeURIComponent("软件工程提示词")}&offset=20`) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.json()).toEqual(await Effect.runPromise(getPromptsCurationPage(20, 20, "软件工程提示词")));
    expect(await (await GET({ request: new Request("http://localhost/api/prompts") })).json()).toEqual(
      await Effect.runPromise(getPromptsCurationPage()),
    );
    for (const query of ["tag=", `tag=${"a".repeat(41)}`, "offset=-1", "limit=51"]) {
      expect((await GET({ request: new Request(`http://localhost/api/prompts?${query}`) })).status).toBe(400);
    }
  });
});
