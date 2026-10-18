import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { mockPlatform } from "./platform-fixture";
import { createAsk } from "../src/lib/ask";
import { run } from "../src/lib/platform";

let platform: ReturnType<typeof mockPlatform>;
beforeEach(() => { platform = mockPlatform(); });

const source = (id: string) => ({ id, title: id, content: "引用原文", scope: "profile", sourceUrl: "https://example.com/source", publishedAt: null, section: null, sourceId: id });

describe("Ask controller", () => {
  test("uses exact payload, decodes Chinese/emoji one byte at a time and preserves late source order", async () => {
    const ask = createAsk(() => {});
    ask.setDraft("  介绍一下陈远  "); ask.setScope("profile");
    const operation = Effect.runPromise(ask.send());
    const task = platform.latest();
    expect(task.options.data?.question).toBe("介绍一下陈远");
    expect(task.options.data?.scope).toBe("profile");
    expect(task.options.data?.format).toBe("text");
    expect(task.options.data?.visitorId).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(task.options.data?.conversationId).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(task.options.data).not.toHaveProperty("sessionId");
    expect(task.options.enableChunked).toBe(true);
    expect(task.options.timeout).toBe(120_000);
    task.headers(200);
    const stream = 'event: text\r\ndata: {"delta":"中文😀【1】"}\r\n\r\n';
    for (const byte of new TextEncoder().encode(stream)) task.bytes(Uint8Array.of(byte));
    expect(ask.state.messages[1]?.text).toBe("中文😀【1】");
    expect(ask.state.messages[1]?.sources).toEqual([]);
    task.frame("sources", { sources: [source("b"), source("a"), source("b")] });
    task.frame("done", {}); await operation;
    expect(ask.state.messages[1]?.sources.map((value) => value.id)).toEqual(["b", "a", "b"]);
    expect(ask.state.messages[1]?.status).toBe("complete");
    expect(ask.state.streaming).toBe(false);
    expect(ask.state.error).toBe("");
    expect(task.aborted).toBe(true);
    task.success(new TextEncoder().encode(stream).buffer);
    expect(ask.state.messages[1]?.text).toBe("中文😀【1】");
  });

  test("handles full-body fallback, EOF tail done and empty-answer fallback", async () => {
    const ask = createAsk(() => {});
    let operation = Effect.runPromise(ask.send("介绍陈远"));
    platform.latest().success(new TextEncoder().encode('event: text\ndata: {"delta":"正文"}\n\nevent: done\ndata: {}').buffer);
    await operation;
    expect(ask.state.messages[1]?.text).toBe("正文");
    operation = Effect.runPromise(ask.send("还有资料")); platform.latest().frame("done", {}); await operation;
    expect(ask.state.messages[3]?.text).toContain("没有可回答的内容");
  });

  test("does not double consume full response after chunk callbacks", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    const task = platform.latest();
    const body = 'event: text\ndata: {"delta":"一次"}\n\nevent: done\ndata: {}';
    task.text(body); task.success(new TextEncoder().encode(body).buffer); await operation;
    expect(ask.state.messages[1]?.text).toBe("一次");
  });

  test("surfaces HTTP JSON errors and early EOF with retained partial text", async () => {
    const ask = createAsk(() => {});
    let operation = Effect.runPromise(ask.send("介绍陈远"));
    platform.latest().headers(429); platform.latest().text('{"error":"请五分钟后再试"}'); platform.latest().success(new TextEncoder().encode('{"error":"请五分钟后再试"}').buffer, 429); await operation;
    expect(ask.state.error).toBe("请五分钟后再试");
    expect(ask.state.messages[1]?.status).toBe("error");
    operation = Effect.runPromise(ask.send("再说一些"));
    platform.latest().frame("text", { delta: "收到一半" }); platform.latest().success(new ArrayBuffer(0)); await operation;
    expect(ask.state.error).toContain("提前结束");
    expect(ask.state.messages[3]?.text).toBe("收到一半");
  });

  test("handles non2xx when DevTools omitted header status and final body is empty", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    platform.latest().text('{"error":"服务维护"}'); platform.latest().success(new ArrayBuffer(0), 503); await operation;
    expect(ask.state.error).toBe("服务维护");
  });

  test("malformed SSE stops the request and blocks late data", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    const task = platform.latest();
    task.frame("text", { delta: 3 }); await operation;
    expect(task.aborted).toBe(true);
    expect(ask.state.error).toContain("数据格式异常");
    task.frame("text", { delta: "迟到" }); task.frame("done", {});
    expect(ask.state.messages[1]?.text).toBe("");
    expect(ask.state.messages[1]?.status).toBe("error");
  });

  test("stop aborts without caller interruption; reset and retry isolate old callbacks and original scope", async () => {
    const ask = createAsk(() => {});
    const first = Effect.runPromiseExit(ask.send("介绍陈远", "profile"));
    const old = platform.latest();
    old.frame("text", { delta: "半句" });
    const firstConversation = old.options.data?.conversationId;
    const visitor = old.options.data?.visitorId;
    ask.stop();
    expect(old.aborted).toBe(true);
    expect(ask.state.messages[1]?.status).toBe("stopped");
    expect((await first)._tag).toBe("Failure");
    ask.setScope("daily");
    const retry = Effect.runPromise(ask.retry());
    expect(platform.latest().options.data?.scope).toBe("profile");
    expect(platform.latest().options.data?.conversationId).toBe(firstConversation);
    old.frame("text", { delta: "旧数据" }); old.frame("done", {});
    platform.latest().frame("text", { delta: "重新回答" }); platform.latest().frame("done", {}); await retry;
    expect(ask.state.messages).toHaveLength(2);
    expect(ask.state.messages[1]?.text).toBe("重新回答");
    ask.reset();
    const next = Effect.runPromise(ask.send("新问题"));
    expect(platform.latest().options.data?.conversationId).not.toBe(firstConversation);
    expect(platform.latest().options.data?.visitorId).toBe(visitor);
    platform.latest().frame("done", {}); await next;
  });

  test("caller cancellation stops real request and unlocks controller", () => {
    const ask = createAsk(() => {});
    const cancel = run(ask.send("介绍陈远"));
    const task = platform.latest(); cancel();
    expect(task.aborted).toBe(true);
    expect(ask.state.streaming).toBe(false);
    expect(ask.state.messages[1]?.status).toBe("stopped");
  });

  test("reports server SSE errors, timeout failures and non2xx fallback messages", async () => {
    const ask = createAsk(() => {});
    let operation = Effect.runPromise(ask.send("介绍陈远"));
    platform.latest().frame("error", { message: "回答服务暂不可用" }); await operation;
    expect(ask.state.error).toBe("回答服务暂不可用");
    operation = Effect.runPromise(ask.send("再试一次")); platform.latest().fail("request:fail timeout"); await operation;
    expect(ask.state.error).toContain("超时");
    operation = Effect.runPromise(ask.send("继续提问")); platform.latest().success("not JSON", 429); await operation;
    expect(ask.state.error).toContain("过于频繁");
  });

  test("storage failure is recoverable and never sends an unpersisted visitor", async () => {
    const originalStorage = wx.setStorageSync;
    wx.setStorageSync = () => { throw new Error("storage unavailable"); };
    const ask = createAsk(() => {});
    await Effect.runPromise(ask.send("介绍陈远"));
    expect(platform.requests).toHaveLength(0);
    expect(ask.state.error).toContain("本地会话无法保存");
    wx.setStorageSync = originalStorage;
    const retry = Effect.runPromise(ask.retry()); platform.latest().frame("done", {}); await retry;
    expect(ask.state.error).toBe("");
    expect(ask.state.messages).toHaveLength(2);
  });

  test("reset during asynchronous identifier generation cannot restore an old conversation", async () => {
    const pending: { length: number; success?: (response: { randomValues: ArrayBuffer; errMsg: string }) => void }[] = [];
    wx.getRandomValues = (options) => { pending.push(options); return undefined as never; };
    const ask = createAsk(() => {});
    const stale = Effect.runPromise(ask.send("旧的问题"));
    expect(pending).toHaveLength(1);
    ask.reset();
    const current = Effect.runPromise(ask.send("新的问题"));
    expect(pending).toHaveLength(2);
    pending[0]?.success?.({ randomValues: new Uint8Array(16).fill(4).buffer, errMsg: "ok" });
    await stale;
    expect(platform.requests).toHaveLength(0);
    pending[1]?.success?.({ randomValues: new Uint8Array(16).fill(5).buffer, errMsg: "ok" });
    await Promise.resolve();
    expect(pending).toHaveLength(3);
    pending[2]?.success?.({ randomValues: new Uint8Array(16).fill(6).buffer, errMsg: "ok" });
    await Promise.resolve();
    const task = platform.latest();
    expect(task.options.data?.question).toBe("新的问题");
    expect(task.options.data?.conversationId).toBe("06".repeat(16));
    task.frame("done", {}); await current;
    expect(ask.state.messages[0]?.text).toBe("新的问题");
  });

  test("validates questions without network, guards concurrent sends and persists visitor across controllers", async () => {
    const ask = createAsk(() => {});
    await Effect.runPromise(ask.send("a"));
    await Effect.runPromise(ask.send("x".repeat(1001)));
    expect(platform.requests).toHaveLength(0);
    expect(ask.state.error).toContain("2–1000");
    let operation = Effect.runPromise(ask.send("有效问题"));
    const visitor = platform.latest().options.data?.visitorId;
    await Effect.runPromise(ask.send("重复提交")); expect(platform.requests).toHaveLength(1);
    platform.latest().frame("done", {}); await operation;
    operation = Effect.runPromise(createAsk(() => {}).send("新的页面"));
    expect(platform.latest().options.data?.visitorId).toBe(visitor);
    platform.latest().frame("done", {}); await operation;
  });
});
