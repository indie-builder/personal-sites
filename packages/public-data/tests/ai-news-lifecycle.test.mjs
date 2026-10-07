import { Cause, Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { it } from "node:test";
import { openArchive, readPublicRows } from "../src/ai-news/archive.mjs";
import { fetchFeed, syncAiNews } from "../src/ai-news/sync.mjs";
import { createSupabaseAiNewsStateStore } from "../src/ai-news/state.mjs";

it("malformed feed JSON stays in the typed failure channel", async () => {
  for (const payload of [null, {}, [], { items: null }]) {
    const exit = await Effect.runPromiseExit(fetchFeed("all", {
      fetchImpl: async () => new Response(JSON.stringify(payload)),
    }));
    assert.equal(exit._tag, "Failure");
    assert.equal(Cause.hasDies(exit.cause), false);
  }
});

it("interrupting body consumption aborts the fetch transport", async () => {
  const controller = new AbortController();
  let transportSignal;
  await Effect.runPromiseExit(fetchFeed("all", {
    fetchImpl: async (_url, { signal }) => {
      transportSignal = signal;
      return { ok: true, status: 200, headers: new Headers(), json() {
        queueMicrotask(() => controller.abort());
        return new Promise(() => {});
      } };
    },
  }), { signal: controller.signal });
  assert.equal(transportSignal.aborted, true);
});

for (const method of ["function", "exec"]) {
  it(`closes SQLite when initialization ${method} fails`, () => {
    const original = Database.prototype[method];
    let database;
    Database.prototype[method] = function () { database = this; throw new Error("injected initialization failure"); };
    try {
      assert.throws(() => openArchive(":memory:", false), /injected/);
      assert.equal(database.open, false);
    } finally {
      Database.prototype[method] = original;
      if (database?.open) database.close();
    }
  });
}

it("Supabase reads and lease writes forward interruption to the actual fetch transport", async () => {
  for (const operation of [
    (client) => readPublicRows(client),
    (client) => createSupabaseAiNewsStateStore(client).acquire({ now: new Date() }),
    (client) => createSupabaseAiNewsStateStore(client).health(),
    (client) => createSupabaseAiNewsStateStore(client).isAuthorized("fixture"),
  ]) {
    const controller = new AbortController();
    let transportSignal;
    const client = createClient("https://example.test", "fixture", { global: { fetch: (_url, init) => {
      transportSignal = init.signal;
      queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    } } });
    await Effect.runPromiseExit(operation(client), { signal: controller.signal });
    assert.ok(transportSignal);
    assert.equal(transportSignal.aborted, true);
  }
});

it("a replaced lease cannot be released by its previous owner", async () => {
  const token = { startedAt: "2026-10-07T00:00:00.000Z", leaseUntil: "2026-10-07T00:04:00.000Z" };
  const requests = [];
  const client = createClient("https://example.test", "fixture", { global: { fetch: async (url) => {
    requests.push(new URL(url));
    return new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } });
  } } });
  const state = createSupabaseAiNewsStateStore(client);
  await Effect.runPromise(state.fail({ token, error: new Error("old failure") }));
  await assert.rejects(Effect.runPromise(state.succeed({ token, etags: {}, stats: {} })), /租约/);
  for (const request of requests) {
    assert.equal(request.searchParams.get("last_started_at"), `eq.${token.startedAt}`);
    assert.equal(request.searchParams.get("lease_until"), `eq.${token.leaseUntil}`);
  }
});

it("the three minute deadline includes acquisition and aborts an in-flight write before releasing its lease", async () => {
  let transportSignal;
  let failures = 0;
  let writes = 0;
  await Effect.runPromise(Effect.gen(function* () {
    const writing = yield* Deferred.make();
    const client = createClient("https://example.test", "fixture", { global: { fetch: async (_url, init) => {
      if (init.method === "GET") return new Response("[]");
      writes += 1;
      transportSignal = init.signal;
      Deferred.doneUnsafe(writing, Effect.void);
      return new Promise(() => {});
    } } });
    const fiber = yield* syncAiNews({
      now: new Date("2000-01-01T00:00:00Z"),
      env: { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture" },
      clientFactory: () => client,
      fetchImpl: async () => new Response(JSON.stringify({ items: [{ id: "fixture" }] })),
      stateStore: {
        acquire: () => Effect.sleep("1 minute").pipe(Effect.as({ acquired: true, etags: {}, token: {} })),
        assertOwned: ({ now }) => Effect.sync(() => assert.equal(now.toISOString(), "2000-01-01T00:01:00.000Z")),
        fail: () => Effect.sync(() => { assert.equal(transportSignal.aborted, true); failures += 1; }),
        succeed: () => Effect.die("must time out"),
      },
    }).pipe(Effect.forkScoped);
    yield* TestClock.adjust("1 minute");
    yield* Deferred.await(writing);
    yield* TestClock.adjust("2 minutes");
    const exit = yield* Fiber.await(fiber);
    assert.equal(exit._tag, "Failure");
    assert.match(String(Cause.squash(exit.cause)), /3 分钟/);
  }).pipe(Effect.scoped, Effect.provide(TestClock.layer())));
  assert.equal(writes, 1);
  assert.equal(failures, 1);
});

it("ownership loss stops before the next data mutation", async () => {
  let writes = 0;
  let released = 0;
  const client = createClient("https://example.test", "fixture", { global: { fetch: async (_url, init) => {
    if (init.method !== "GET") writes += 1;
    return new Response("[]");
  } } });
  await assert.rejects(Effect.runPromise(syncAiNews({
    env: { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture" },
    clientFactory: () => client,
    fetchImpl: async () => new Response(JSON.stringify({ items: [{ id: "fixture" }] })),
    stateStore: {
      acquire: () => Effect.succeed({ acquired: true, etags: {}, token: {} }),
      assertOwned: () => Effect.fail(new Error("lost owner")),
      fail: () => Effect.sync(() => { released += 1; }),
      succeed: () => Effect.die("must not succeed"),
    },
  })), /lost owner/);
  assert.equal(writes, 0);
  assert.equal(released, 1);
});
