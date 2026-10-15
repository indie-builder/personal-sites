import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "../src/routes/api/ai-news/$id";
import type { AiNewsItem } from "../lib/ai-news-types";

// vitest 不经过 TanStack 的 vite 插件：server handlers 挂在 route options 上。
const GET = (Route.options.server?.handlers as {
  GET: (ctx: { request: Request; params: { id: string } }) => Response | Promise<Response>;
}).GET;

vi.mock("../lib/ai-news", () => ({
  getAiNewsItem: vi.fn(),
}));

const { getAiNewsItem } = await import("../lib/ai-news");
const getAiNewsItemMock = vi.mocked(getAiNewsItem);

const sampleItem: AiNewsItem = {
  category: "ai-models",
  id: "cmssv94cg0h4mroffsb9e7a88",
  publishedAt: "2026-08-14T11:25:29.000Z",
  reason: "长程智能体方向值得关注。",
  score: 79,
  selected: true,
  sourceName: "公众号：小红书技术（dots.llm）",
  summary: "小红书技术开源 dots3-note Preview。",
  title: "dots3-note Preview 开源",
  url: "https://mp.weixin.qq.com/s/example",
};

describe("GET /api/ai-news/[id]", () => {
  beforeEach(() => {
    getAiNewsItemMock.mockReset();
  });

  it("serves the full item payload with the public cache header", async () => {
    getAiNewsItemMock.mockReturnValue(Effect.succeed(sampleItem));

    const response = await GET({
      request: new Request("http://localhost/api/ai-news/x"),
      params: { id: sampleItem.id },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    await expect(response.json()).resolves.toEqual({ item: sampleItem });
    expect(getAiNewsItemMock).toHaveBeenCalledWith(sampleItem.id);
  });

  it("returns a JSON 404 when the id is unknown", async () => {
    getAiNewsItemMock.mockReturnValue(Effect.succeed(null));

    const response = await GET({
      request: new Request("http://localhost/api/ai-news/missing"),
      params: { id: "missing" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "未找到这条每日动态。" });
  });

  it("reports read failures as a JSON 500", async () => {
    getAiNewsItemMock.mockReturnValue(Effect.fail(new Error("supabase down")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET({
      request: new Request("http://localhost/api/ai-news/x"),
      params: { id: "x" },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "暂时无法读取这条每日动态。" });
    expect(errorSpy).toHaveBeenCalledWith("读取每日动态详情失败", expect.any(Error));
    errorSpy.mockRestore();
  });
});
