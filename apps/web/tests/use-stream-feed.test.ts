import { afterEach, describe, expect, it, vi } from "vitest";

import { requestStreamPage } from "../components/use-stream-feed";

type TestItem = { id: string };

const FALLBACK = "暂时无法加载更多策展内容。";

function stubFetchOnce(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestStreamPage", () => {
  it("返回成功分页负载，并带超时中止信号发起请求", async () => {
    const payload = { hasMore: true, items: [{ id: "b" }] };
    const fetchMock = stubFetchOnce(async () => jsonResponse(payload));

    const result = await requestStreamPage<TestItem>("/api/curation?offset=1&limit=1", FALLBACK);

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("网关返回 HTML 错误页时回落兜底文案，不泄漏解析错误", async () => {
    stubFetchOnce(async () =>
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("非 2xx 且服务端给出 error 时原样展示服务端文案", async () => {
    stubFetchOnce(async () =>
      jsonResponse({ error: "策展内容暂时不可用。" }, { status: 500 }),
    );

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe("策展内容暂时不可用。");
  });

  it("非 2xx 且响应体不是 JSON 时回落兜底文案", async () => {
    stubFetchOnce(async () => new Response("Service Unavailable", { status: 503 }));

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("2xx 但响应体不是 JSON 时回落兜底文案", async () => {
    stubFetchOnce(async () => new Response("<html>unexpected</html>"));

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("2xx 但负载形状非法（缺 items/hasMore）时回落兜底文案", async () => {
    stubFetchOnce(async () => jsonResponse({}));

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("2xx 但 items 不是数组时回落兜底文案", async () => {
    stubFetchOnce(async () => jsonResponse({ hasMore: false, items: "oops" }));

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("非 2xx 且 error 为空串或非字符串时回落兜底文案", async () => {
    stubFetchOnce(async () => jsonResponse({ error: "" }, { status: 500 }));
    expect(await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK)).toBe(FALLBACK);

    stubFetchOnce(async () => jsonResponse({ error: { message: "boom" } }, { status: 500 }));
    expect(await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK)).toBe(FALLBACK);
  });

  it("网络中断回落兜底文案，不暴露 Failed to fetch", async () => {
    stubFetchOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });

  it("请求超时回落兜底文案", async () => {
    stubFetchOnce(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    const result = await requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK);

    expect(result).toBe(FALLBACK);
  });
});
