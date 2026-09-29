import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/ai-news/[id]/route";
import type { AiNewsItem } from "../lib/ai-news-types";

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
    getAiNewsItemMock.mockResolvedValue(sampleItem);

    const response = await GET(new Request("http://localhost/api/ai-news/x"), {
      params: Promise.resolve({ id: sampleItem.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    await expect(response.json()).resolves.toEqual({ item: sampleItem });
    expect(getAiNewsItemMock).toHaveBeenCalledWith(sampleItem.id);
  });

  it("returns a JSON 404 when the id is unknown", async () => {
    getAiNewsItemMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/ai-news/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "未找到这条每日动态。" });
  });

  it("reports read failures as a JSON 500", async () => {
    getAiNewsItemMock.mockRejectedValue(new Error("supabase down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new Request("http://localhost/api/ai-news/x"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "暂时无法读取这条每日动态。" });
    expect(errorSpy).toHaveBeenCalledWith("读取每日动态详情失败", expect.any(Error));
    errorSpy.mockRestore();
  });
});
