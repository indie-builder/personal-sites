import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as Fiber from "effect/Fiber";
import { Effect } from "../src/lib/runtime";
import { createCollection } from "../src/portfolio/api";
import { mockPortfolioRequests, page } from "./portfolio-fixture";

let requests: ReturnType<typeof mockPortfolioRequests>;
beforeEach(() => { requests = mockPortfolioRequests(); });
afterEach(() => { requests.restore(); });

describe("portfolio collection controller", () => {
  test("deduplicates within and across pages while advancing by raw rows", async () => {
    const collection = createCollection("layouts", () => {});
    const first = Effect.runPromise(collection.load());
    requests.respond(await requests.nextRequest(), page(["a", "a", "b"]));
    await first;
    const more = Effect.runPromise(collection.load("more"));
    const request = await requests.nextRequest();
    expect(request.url).toContain("offset=3&limit=24");
    requests.respond(request, page(["b", "c", "c"]));
    await more;
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    const third = Effect.runPromise(collection.load("more"));
    const thirdRequest = await requests.nextRequest();
    expect(thirdRequest.url).toContain("offset=6&limit=24");
    requests.respond(thirdRequest, page([], true));
    await third;
    expect(collection.state.hasMore).toBe(false);
    expect(collection.state.total).toBe(80);
    expect(collection.state.attribution).toBe("创作者 · CC BY 4.0");
  });

  test("refresh failure retains items and cursor; retry success clears error", async () => {
    const collection = createCollection("muse", () => {});
    const initial = Effect.runPromise(collection.load());
    requests.respond(await requests.nextRequest(), page(["a", "b"]));
    await initial;
    const refresh = Effect.runPromise(collection.load("refresh"));
    requests.respond(await requests.nextRequest(), { error: "服务不可用" }, 500);
    await refresh;
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(collection.state.error).toContain("重试");
    expect(collection.state.loading).toBe(false);
    const more = Effect.runPromise(collection.load("more"));
    const request = await requests.nextRequest();
    expect(request.url).toContain("offset=2&limit=24");
    requests.respond(request, page(["c"], false));
    await more;
    expect(collection.state.error).toBe("");
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("new filters reset cursor and ignore old generation success or failure", async () => {
    for (const status of [200, 500]) {
      const collection = createCollection("layouts", () => {});
      const old = Effect.runPromise(collection.load());
      const oldRequest = await requests.nextRequest();
      collection.setFilters({ q: "  网格  ", cat: "type", theme: "grid" });
      const current = Effect.runPromise(collection.load());
      const currentRequest = await requests.nextRequest();
      expect(currentRequest.url).toContain("offset=0&limit=24&q=%E7%BD%91%E6%A0%BC&cat=type&theme=grid");
      requests.respond(currentRequest, page(["new"], false));
      await current;
      requests.respond(oldRequest, status === 200 ? page(["old"]) : { error: "old error" }, status);
      await old;
      expect(collection.state.items.map((item) => item.id)).toEqual(["new"]);
      expect(collection.state.error).toBe("");
      expect(collection.state.loading).toBe(false);
      expect(collection.state.filters.q).toBe("网格");
    }
  });

  test("prevents overlapping loads and cancellation aborts request and unlocks loading", async () => {
    const collection = createCollection("layouts", () => {});
    const fiber = Effect.runFork(collection.load());
    const request = await requests.nextRequest();
    await Effect.runPromise(collection.load("more"));
    expect(requests.pending).toHaveLength(0);
    expect(collection.state.loading).toBe(true);
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(request.aborted).toBe(true);
    expect(collection.state.loading).toBe(false);
    expect(collection.state.error).toBe("");
    const retry = Effect.runPromise(collection.load());
    requests.respond(await requests.nextRequest(), page(["ok"], false));
    await retry;
    expect(collection.state.items[0]?.id).toBe("ok");
  });

  test("malformed upstream data is recoverable and dispose prevents late updates", async () => {
    let updates = 0;
    const collection = createCollection("muse", () => { updates += 1; });
    const malformed = Effect.runPromise(collection.load());
    requests.respond(await requests.nextRequest(), { ...page(["a"]), total: "80" });
    await malformed;
    expect(collection.state.error).toContain("重试");
    expect(collection.state.items).toEqual([]);
    const delayed = Effect.runPromise(collection.load());
    const request = await requests.nextRequest();
    collection.dispose();
    const before = updates;
    requests.respond(request, page(["late"]));
    await delayed;
    expect(updates).toBe(before);
    expect(collection.state.items).toEqual([]);
  });
});
