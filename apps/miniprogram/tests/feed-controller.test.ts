import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { mockPlatform } from "./platform-fixture";
import { createFeed, dateLabel } from "../src/lib/content";
import { run } from "../src/lib/platform";
import { news } from "./content-fixtures";

let platform: ReturnType<typeof mockPlatform>;
beforeEach(() => { platform = mockPlatform(); });

test("feed dates match iOS relative-time boundaries and omit invalid values", () => {
  const now = Date.parse("2026-10-18T10:00:00Z");
  expect(dateLabel(null, now)).toBe("");
  expect(dateLabel("invalid", now)).toBe("");
  expect(dateLabel("2026-10-18T09:59:59Z", now)).toBe("刚刚");
  expect(dateLabel("2026-10-18T09:35:00Z", now)).toBe("25 分钟前");
  expect(dateLabel("2026-10-18T08:00:00Z", now)).toBe("2 小时前");
  expect(dateLabel("2026-10-15T10:00:00Z", now)).toBe("3 天前");
  expect(dateLabel("2026-08-15T10:00:00Z", now)).toBe("8月15日");
  expect(dateLabel("2026-10-19T10:00:00Z", now)).toBe("刚刚");
});

describe("feed controller", () => {
  test("deduplicates visible rows while advancing cursor by every raw server row", async () => {
    const feed = createFeed("ai-news", () => {});
    const first = Effect.runPromise(feed.load());
    platform.latest().success({ items: Array.from({ length: 50 }, (_, index) => news(index < 25 ? "a" : "b")), hasMore: true });
    await first;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b"]);
    const more = Effect.runPromise(feed.load("more"));
    expect(platform.latest().options.url).toContain("offset=50&limit=50");
    platform.latest().success({ items: [news("b"), news("c")], hasMore: false });
    await more;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(feed.state.loaded).toBe(true);
    expect(feed.state.hasMore).toBe(false);
  });

  test("refresh failure preserves content/cursor and allows more retry", async () => {
    const feed = createFeed("ai-news", () => {});
    let operation = Effect.runPromise(feed.load());
    platform.latest().success({ items: [news("a"), news("b")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("refresh"));
    expect(feed.state.refreshing).toBe(true);
    expect(platform.latest().options.url).toContain("offset=0");
    platform.latest().fail(); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(feed.state.error).toContain("网络");
    expect(feed.state.loading || feed.state.refreshing).toBe(false);
    operation = Effect.runPromise(feed.load("more"));
    expect(platform.latest().options.url).toContain("offset=2");
    platform.latest().success({ items: [news("c")], hasMore: false }); await operation;
    expect(feed.state.error).toBe("");
    expect(feed.state.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  test("a failed refresh at the end can be explicitly retried through more", async () => {
    const feed = createFeed("ai-news", () => {});
    let operation = Effect.runPromise(feed.load()); platform.latest().success({ items: [news("a")], hasMore: false }); await operation;
    operation = Effect.runPromise(feed.load("refresh")); platform.latest().fail(); await operation;
    operation = Effect.runPromise(feed.load("more"));
    expect(platform.latest().options.url).toContain("offset=1");
    platform.latest().success({ items: [], hasMore: false }); await operation;
    expect(feed.state.error).toBe("");
  });

  test("cancellation unlocks loading, prevents stale results and disposal aborts", async () => {
    let updates = 0;
    const feed = createFeed("ai-news", () => { updates++; });
    const cancel = run(feed.load());
    const oldTask = platform.latest();
    await Effect.runPromise(feed.load("more"));
    expect(platform.requests.length).toBe(1);
    cancel();
    expect(oldTask.aborted).toBe(true);
    expect(feed.state.loading).toBe(false);
    const operation = Effect.runPromise(feed.load());
    const currentTask = platform.latest();
    oldTask.success({ items: [news("stale")], hasMore: true });
    currentTask.success({ items: [news("fresh")], hasMore: true }); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["fresh"]);
    const cancelMore = run(feed.load("more"));
    const active = platform.latest();
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
    let operation = Effect.runPromise(feed.load()); platform.latest().success({ items: [news("old"), news("old2")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("refresh")); platform.latest().success({ items: [news("new")], hasMore: true }); await operation;
    operation = Effect.runPromise(feed.load("more"));
    expect(platform.latest().options.url).toContain("offset=1");
    platform.latest().success({ items: [], hasMore: false }); await operation;
    expect(feed.state.items.map((row) => row.id)).toEqual(["new"]);
  });
});
