import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { OperationError } from "@site/effect";
import { createFeed, detailFor, stashRow, takeRow, type FeedRow } from "../src/lib/content";
import { createAsk } from "../src/lib/ask";
import { copyLink, externalUrl, previewImages, request, run, SITE_ORIGIN } from "../src/lib/platform";

type RequestOptions = {
  url: string; data?: Record<string, unknown>; method?: string; timeout?: number; enableChunked?: boolean;
  success?: (response: { statusCode: number; data: unknown }) => void;
  fail?: (error: { errMsg: string }) => void;
};
class FakeRequest {
  aborted = false;
  chunkListener?: (response: { data: ArrayBuffer }) => void;
  headerListener?: (response: { statusCode: number; header: Record<string, string> }) => void;
  constructor(readonly options: RequestOptions) {}
  abort() { this.aborted = true; this.options.fail?.({ errMsg: "request:fail abort" }); }
  onChunkReceived(listener: (response: { data: ArrayBuffer }) => void) { this.chunkListener = listener; }
  offChunkReceived() {}
  onHeadersReceived(listener: (response: { statusCode: number; header: Record<string, string> }) => void) { this.headerListener = listener; }
  offHeadersReceived() {}
  headers(statusCode: number) { this.headerListener?.({ statusCode, header: {} }); }
  bytes(bytes: Uint8Array) { this.chunkListener?.({ data: Uint8Array.from(bytes).buffer }); }
  text(text: string) { this.bytes(new TextEncoder().encode(text)); }
  frame(event: string, data: unknown) { this.text(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
  success(data: unknown, statusCode = 200) { this.options.success?.({ data, statusCode }); }
  fail(message = "request:fail network") { this.options.fail?.({ errMsg: message }); }
}
let requests: FakeRequest[];
let storage: Map<string, unknown>;
let toasts: string[];
let copied: string[];
let previewed: string[][];
let randomCounter: number;
beforeEach(() => {
  requests = []; storage = new Map(); toasts = []; copied = []; previewed = []; randomCounter = 0;
  Object.defineProperty(globalThis, "wx", { configurable: true, value: {
    request(options: RequestOptions) { const request = new FakeRequest(options); requests.push(request); return request; },
    getStorageSync(key: string) { return storage.get(key) ?? ""; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    getRandomValues(options: { length: number; success: (response: { randomValues: ArrayBuffer }) => void }) {
      options.success({ randomValues: new Uint8Array(options.length).fill(++randomCounter).buffer });
    },
    showToast(options: { title: string }) { toasts.push(options.title); },
    setClipboardData(options: { data: string; success: () => void }) { copied.push(options.data); options.success(); },
    previewImage(options: { urls: string[] }) { previewed.push(options.urls); },
  } });
});
const latest = () => {
  const value = requests[requests.length - 1];
  if (!value) throw new Error("Expected a platform request");
  return value;
};
const news = (id: string) => ({ id, category: "ai-models", publishedAt: "2026-10-18T00:00:00Z", selected: true, sourceName: "原文", summary: "标题：导读", title: "标题" });
const curation = (id: string) => ({ id, title: "设计标题", summary: "导读", text: "原文", author: { name: "作者", handle: "handle" }, source: { label: "X", platform: "x", url: "https://x.com/user/status/1" }, collectedAt: null, publishedAt: "2026-10-18", tags: ["设计"], attachments: ["视频"], media: [{ url: "https://pbs.twimg.com/a.jpg", previewUrl: null, videoUrl: "https://video.twimg.com/ext_tw_video/123/pu/vid/a.mp4?tag=1" }], design: { reason: "设计理由" } });
const source = (id: string) => ({ id, title: id, content: "引用原文", scope: "profile", sourceUrl: "https://example.com/source", publishedAt: null, section: null, sourceId: id });

describe("wx Effect adapter", () => {
  test("validates successful data and HTTP/JSON boundary failures", async () => {
    const promise = Effect.runPromise(request("/api/test", Schema.Struct({ value: Schema.String })));
    expect(latest().options.timeout).toBe(20_000);
    latest().success({ value: "内容" });
    expect(await promise).toEqual({ value: "内容" });
    const invalid = Effect.runPromiseExit(request("/api/test", Schema.Struct({ value: Schema.String })));
    latest().success({ value: 3 });
    expect((await invalid)._tag).toBe("Failure");
    const denied = Effect.runPromise(request("/api/test", Schema.Unknown).pipe(Effect.flip));
    latest().success({ error: "暂不可用" }, 503);
    expect(await denied).toBeInstanceOf(OperationError);
    expect((await denied).message).toBe("暂不可用");
  });

  test("run cancellation aborts the task and suppresses all late callbacks", () => {
    let succeeded = false;
    let failed = false;
    const cancel = run(request("/api/test", Schema.Unknown), () => { succeeded = true; }, () => { failed = true; });
    const task = latest();
    cancel();
    expect(task.aborted).toBe(true);
    task.success({ late: true });
    task.fail();
    expect(succeeded).toBe(false);
    expect(failed).toBe(false);
  });

  test("rejects non-http URLs and keeps source actions safe", () => {
    for (const value of ["javascript:alert(1)", "/pages/ask/index", "//evil.com", "https://a.com\\evil", "https://a.com\nevil", "https://name:pass@a.com", "https://"]) expect(externalUrl(value)).toBe("");
    expect(externalUrl(" https://example.com/path?q=1#ok ")).toBe("https://example.com/path?q=1#ok");
    copyLink("javascript:alert(1)");
    copyLink("https://example.com");
    previewImages(["javascript:bad", "https://example.com/1.jpg"], "javascript:bad");
    expect(copied).toEqual(["https://example.com"]);
    expect(previewed).toEqual([["https://example.com/1.jpg"]]);
    expect(toasts).toContain("链接暂不可用");
  });
});

describe("feed controller", () => {
  test("deduplicates visible rows while advancing cursor by every raw server row", async () => {
    const feed = createFeed("ai-news", () => {});
    const first = Effect.runPromise(feed.load());
    latest().success({ items: Array.from({ length: 50 }, (_, index) => news(index < 25 ? "a" : "b")), hasMore: true });
    await first;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b"]);
    const more = Effect.runPromise(feed.load("more"));
    expect(latest().options.url).toContain("offset=50&limit=50");
    latest().success({ items: [news("b"), news("c")], hasMore: false });
    await more;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(feed.state.loaded).toBe(true);
    expect(feed.state.hasMore).toBe(false);
  });

  test("refresh failure preserves content/cursor and allows more retry", async () => {
    const feed = createFeed("ai-news", () => {});
    let operation = Effect.runPromise(feed.load());
    latest().success({ items: [news("a"), news("b")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("refresh"));
    expect(feed.state.refreshing).toBe(true);
    expect(latest().options.url).toContain("offset=0");
    latest().fail(); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(feed.state.error).toContain("网络");
    expect(feed.state.loading || feed.state.refreshing).toBe(false);
    operation = Effect.runPromise(feed.load("more"));
    expect(latest().options.url).toContain("offset=2");
    latest().success({ items: [news("c")], hasMore: false }); await operation;
    expect(feed.state.error).toBe("");
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  test("a failed refresh at the end can be explicitly retried through more", async () => {
    const feed = createFeed("ai-news", () => {});
    let operation = Effect.runPromise(feed.load()); latest().success({ items: [news("a")], hasMore: false }); await operation;
    operation = Effect.runPromise(feed.load("refresh")); latest().fail(); await operation;
    operation = Effect.runPromise(feed.load("more"));
    expect(latest().options.url).toContain("offset=1");
    latest().success({ items: [], hasMore: false }); await operation;
    expect(feed.state.error).toBe("");
  });

  test("cancellation unlocks loading, prevents stale results and disposal aborts", async () => {
    let updates = 0;
    const feed = createFeed("ai-news", () => { updates++; });
    const cancel = run(feed.load());
    const oldTask = latest();
    await Effect.runPromise(feed.load("more"));
    expect(requests.length).toBe(1);
    cancel();
    expect(oldTask.aborted).toBe(true);
    expect(feed.state.loading).toBe(false);
    const operation = Effect.runPromise(feed.load());
    const currentTask = latest();
    oldTask.success({ items: [news("stale")], hasMore: true });
    currentTask.success({ items: [news("fresh")], hasMore: true }); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["fresh"]);
    const cancelMore = run(feed.load("more"));
    const active = latest();
    const count = updates;
    feed.dispose();
    expect(active.aborted).toBe(true);
    active.success({ items: [news("after-dispose")], hasMore: false });
    expect(updates).toBe(count);
    expect(feed.state.loading).toBe(false);
    cancelMore();
  });

  test("successful refresh replaces rows and resets raw cursor", async () => {
    const feed = createFeed("ai-news", () => {});
    let operation = Effect.runPromise(feed.load()); latest().success({ items: [news("old"), news("old2")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("refresh")); latest().success({ items: [news("new")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("more"));
    expect(latest().options.url).toContain("offset=1");
    latest().success({ items: [], hasMore: false }); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["new"]);
  });
});

describe("detail reader", () => {
  test("fetches cold news details, reports expired row-only links explicitly", async () => {
    const promise = Effect.runPromise(detailFor("ai-news", "中文 id"));
    expect(latest().options.url).toContain(encodeURIComponent("中文 id"));
    latest().success({ item: { ...news("中文 id"), reason: "理由", url: "https://example.com/original" } });
    const detail = await promise;
    expect(detail.reason).toBe("理由");
    expect(detail.websiteUrl).toBe(`${SITE_ORIGIN}/ai-news/${encodeURIComponent("中文 id")}`);
    const expired = await Effect.runPromise(detailFor("curation", "no-carrier").pipe(Effect.flip));
    expect(expired.message).toContain("已失效");
  });

  test("maps curation routes and validates X video proxy destinations", async () => {
    const row: FeedRow = { id: "1", title: "设计标题", summary: "导读", meta: "作者", date: "2026-10-18", thumbnail: "", raw: curation("1") };
    const detail = await Effect.runPromise(detailFor("design", "1", row));
    expect(detail.websiteUrl).toBe(`${SITE_ORIGIN}/design/1`);
    expect(detail.media[0]?.videoUrl).toBe(`${SITE_ORIGIN}/api/x-media?url=${encodeURIComponent(curation("1").media[0]?.videoUrl ?? "")}`);
    expect(detail.reason).toBe("设计理由");
    const raw = curation("1");
    const firstMedia = raw.media[0];
    if (!firstMedia) throw new Error("Missing media fixture");
    firstMedia.videoUrl = "https://evil.com/video.mp4";
    const invalid = await Effect.runPromise(detailFor("curation", "1", { ...row, raw }));
    expect(invalid.media[0]?.videoUrl).toBe("");
    expect((await Effect.runPromise(detailFor("douyin", "1", row))).websiteUrl).toBe(`${SITE_ORIGIN}/douyin/1`);
  });

  test("bounds the route carrier to latest twenty entries", () => {
    for (let index = 0; index < 21; index++) stashRow("curation", { id: `carrier-${index}`, title: "", summary: "", meta: "", date: "", thumbnail: "", raw: {} });
    expect(takeRow("curation", "carrier-0")).toBeUndefined();
    expect(takeRow("curation", "carrier-20")?.id).toBe("carrier-20");
  });
});

describe("Ask controller", () => {
  test("uses exact payload, decodes Chinese/emoji one byte at a time and preserves late source order", async () => {
    const ask = createAsk(() => {});
    ask.setDraft("  介绍一下陈远  "); ask.setScope("profile");
    const operation = Effect.runPromise(ask.send());
    const task = latest();
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
    latest().success(new TextEncoder().encode('event: text\ndata: {"delta":"正文"}\n\nevent: done\ndata: {}').buffer);
    await operation;
    expect(ask.state.messages[1]?.text).toBe("正文");
    operation = Effect.runPromise(ask.send("还有资料")); latest().frame("done", {}); await operation;
    expect(ask.state.messages[3]?.text).toContain("没有可回答的内容");
  });

  test("does not double consume full response after chunk callbacks", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    const task = latest();
    const body = 'event: text\ndata: {"delta":"一次"}\n\nevent: done\ndata: {}';
    task.text(body); task.success(new TextEncoder().encode(body).buffer); await operation;
    expect(ask.state.messages[1]?.text).toBe("一次");
  });

  test("surfaces HTTP JSON errors and early EOF with retained partial text", async () => {
    const ask = createAsk(() => {});
    let operation = Effect.runPromise(ask.send("介绍陈远"));
    latest().headers(429); latest().text('{"error":"请五分钟后再试"}'); latest().success(new TextEncoder().encode('{"error":"请五分钟后再试"}').buffer, 429); await operation;
    expect(ask.state.error).toBe("请五分钟后再试");
    expect(ask.state.messages[1]?.status).toBe("error");
    operation = Effect.runPromise(ask.send("再说一些"));
    latest().frame("text", { delta: "收到一半" }); latest().success(new ArrayBuffer(0)); await operation;
    expect(ask.state.error).toContain("提前结束");
    expect(ask.state.messages[3]?.text).toBe("收到一半");
  });

  test("handles non2xx when DevTools omitted header status and final body is empty", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    latest().text('{"error":"服务维护"}'); latest().success(new ArrayBuffer(0), 503); await operation;
    expect(ask.state.error).toBe("服务维护");
  });

  test("malformed SSE stops the request and blocks late data", async () => {
    const ask = createAsk(() => {});
    const operation = Effect.runPromise(ask.send("介绍陈远"));
    const task = latest();
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
    const old = latest();
    old.frame("text", { delta: "半句" });
    const firstConversation = old.options.data?.conversationId;
    const visitor = old.options.data?.visitorId;
    ask.stop();
    expect(old.aborted).toBe(true);
    expect(ask.state.messages[1]?.status).toBe("stopped");
    expect((await first)._tag).toBe("Failure");
    ask.setScope("daily");
    const retry = Effect.runPromise(ask.retry());
    expect(latest().options.data?.scope).toBe("profile");
    expect(latest().options.data?.conversationId).toBe(firstConversation);
    old.frame("text", { delta: "旧数据" }); old.frame("done", {});
    latest().frame("text", { delta: "重新回答" }); latest().frame("done", {}); await retry;
    expect(ask.state.messages).toHaveLength(2);
    expect(ask.state.messages[1]?.text).toBe("重新回答");
    ask.reset();
    const next = Effect.runPromise(ask.send("新问题"));
    expect(latest().options.data?.conversationId).not.toBe(firstConversation);
    expect(latest().options.data?.visitorId).toBe(visitor);
    latest().frame("done", {}); await next;
  });

  test("caller cancellation stops real request and unlocks controller", () => {
    const ask = createAsk(() => {});
    const cancel = run(ask.send("介绍陈远"));
    const task = latest(); cancel();
    expect(task.aborted).toBe(true);
    expect(ask.state.streaming).toBe(false);
    expect(ask.state.messages[1]?.status).toBe("stopped");
  });

  test("reports server SSE errors, timeout failures and non2xx fallback messages", async () => {
    const ask = createAsk(() => {});
    let operation = Effect.runPromise(ask.send("介绍陈远"));
    latest().frame("error", { message: "回答服务暂不可用" }); await operation;
    expect(ask.state.error).toBe("回答服务暂不可用");
    operation = Effect.runPromise(ask.send("再试一次")); latest().fail("request:fail timeout"); await operation;
    expect(ask.state.error).toContain("超时");
    operation = Effect.runPromise(ask.send("继续提问")); latest().success("not JSON", 429); await operation;
    expect(ask.state.error).toContain("过于频繁");
  });

  test("storage failure is recoverable and never sends an unpersisted visitor", async () => {
    const originalStorage = wx.setStorageSync;
    wx.setStorageSync = () => { throw new Error("storage unavailable"); };
    const ask = createAsk(() => {});
    await Effect.runPromise(ask.send("介绍陈远"));
    expect(requests).toHaveLength(0);
    expect(ask.state.error).toContain("本地会话无法保存");
    wx.setStorageSync = originalStorage;
    const retry = Effect.runPromise(ask.retry()); latest().frame("done", {}); await retry;
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
    expect(requests).toHaveLength(0);
    pending[1]?.success?.({ randomValues: new Uint8Array(16).fill(5).buffer, errMsg: "ok" });
    await Promise.resolve();
    expect(pending).toHaveLength(3);
    pending[2]?.success?.({ randomValues: new Uint8Array(16).fill(6).buffer, errMsg: "ok" });
    await Promise.resolve();
    const task = latest();
    expect(task.options.data?.question).toBe("新的问题");
    expect(task.options.data?.conversationId).toBe("06".repeat(16));
    task.frame("done", {}); await current;
    expect(ask.state.messages[0]?.text).toBe("新的问题");
  });

  test("validates questions without network, guards concurrent sends and persists visitor across controllers", async () => {
    const ask = createAsk(() => {});
    await Effect.runPromise(ask.send("a"));
    await Effect.runPromise(ask.send("x".repeat(1001)));
    expect(requests).toHaveLength(0);
    expect(ask.state.error).toContain("2–1000");
    let operation = Effect.runPromise(ask.send("有效问题"));
    const visitor = latest().options.data?.visitorId;
    await Effect.runPromise(ask.send("重复提交")); expect(requests).toHaveLength(1);
    latest().frame("done", {}); await operation;
    operation = Effect.runPromise(createAsk(() => {}).send("新的页面"));
    expect(latest().options.data?.visitorId).toBe(visitor);
    latest().frame("done", {}); await operation;
  });
});
