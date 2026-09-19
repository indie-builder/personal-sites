import { describe, expect, it, vi } from "vitest";

import { createPaginatedFeedRoute } from "../lib/paginated-route";

const readPage = vi.fn(async (offset: number, _limit: number) => ({ hasMore: offset < 100, items: [] }));
const GET = createPaginatedFeedRoute({ label: "测试版块", maxLimit: 50, pageStep: 20, readPage });

function request(query: string) {
  return new Request(`http://localhost/api/test${query}`);
}

describe("createPaginatedFeedRoute", () => {
  it("serves pages at the fixed step with the public cache header", async () => {
    const response = await GET(request("?offset=0&limit=20"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    expect(readPage).toHaveBeenLastCalledWith(0, 20);
  });

  it("floors offset down to a step multiple so cache keys stay finite", async () => {
    await GET(request("?offset=37"));

    expect(readPage).toHaveBeenLastCalledWith(20, 20);
  });

  it("validates limit against the max but still serves the fixed step", async () => {
    await GET(request("?limit=30"));

    expect(readPage).toHaveBeenLastCalledWith(0, 20);
  });

  it("rejects out-of-range pagination params with a JSON 400 without touching the reader", async () => {
    const callsBefore = readPage.mock.calls.length;
    for (const query of ["?limit=999", "?limit=0", "?limit=abc", "?offset=10001"]) {
      const response = await GET(request(query));

      expect(response.status, query).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "分页参数无效。" });
    }
    expect(readPage).toHaveBeenCalledTimes(callsBefore);
    // offset 上界本身合法：取整后仍会读页。
    await GET(request("?offset=10000"));
    expect(readPage).toHaveBeenLastCalledWith(10000, 20);
    expect(readPage).toHaveBeenCalledTimes(callsBefore + 1);
  });

  it("reports read failures with the section label in a JSON 500", async () => {
    const failing = createPaginatedFeedRoute({
      label: "测试版块",
      maxLimit: 50,
      pageStep: 20,
      readPage: async () => {
        throw new Error("db down");
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await failing(request(""));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "暂时无法加载更多测试版块。" });
    expect(errorSpy).toHaveBeenCalledWith("读取测试版块分页失败", expect.any(Error));
    errorSpy.mockRestore();
  });
});
