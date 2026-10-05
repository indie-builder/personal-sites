import { Effect } from "effect";
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

    const result = await Effect.runPromise(requestStreamPage<TestItem>("/api/curation?offset=1&limit=1", FALLBACK));

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    {
      expected: FALLBACK,
      name: "网关返回 HTML 错误页时回落兜底文案，不泄漏解析错误",
      respond: () => new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    },
    {
      expected: "策展内容暂时不可用。",
      name: "非 2xx 且服务端给出 error 时原样展示服务端文案",
      respond: () => jsonResponse({ error: "策展内容暂时不可用。" }, { status: 500 }),
    },
    {
      expected: FALLBACK,
      name: "非 2xx 且响应体不是 JSON 时回落兜底文案",
      respond: () => new Response("Service Unavailable", { status: 503 }),
    },
    {
      expected: FALLBACK,
      name: "2xx 但响应体不是 JSON 时回落兜底文案",
      respond: () => new Response("<html>unexpected</html>"),
    },
    {
      expected: FALLBACK,
      name: "2xx 但负载形状非法（缺 items/hasMore）时回落兜底文案",
      respond: () => jsonResponse({}),
    },
    {
      expected: FALLBACK,
      name: "2xx 但 items 不是数组时回落兜底文案",
      respond: () => jsonResponse({ hasMore: false, items: "oops" }),
    },
    {
      expected: FALLBACK,
      name: "非 2xx 且 error 为空串时回落兜底文案",
      respond: () => jsonResponse({ error: "" }, { status: 500 }),
    },
    {
      expected: FALLBACK,
      name: "非 2xx 且 error 非字符串时回落兜底文案",
      respond: () => jsonResponse({ error: { message: "boom" } }, { status: 500 }),
    },
    {
      expected: FALLBACK,
      name: "网络中断回落兜底文案，不暴露 Failed to fetch",
      respond: () => {
        throw new TypeError("Failed to fetch");
      },
    },
    {
      expected: FALLBACK,
      name: "请求超时回落兜底文案",
      respond: () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    },
  ])("$name", async ({ expected, respond }) => {
    stubFetchOnce(async () => respond());

    const result = await Effect.runPromise(requestStreamPage<TestItem>("/api/curation?offset=20&limit=20", FALLBACK));

    expect(result).toBe(expected);
  });
});
