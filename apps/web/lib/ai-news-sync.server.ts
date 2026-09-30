import { Effect } from "effect";
import { attempt } from "@site/effect";
import "server-only";

import { getAdminSupabaseClient } from "@/lib/supabase.server";
import { syncAiNews } from "@site/public-data/ai-news/sync.mjs";
import { toPublicAiNewsHealth } from "@site/public-data/ai-news/public-health.mjs";
import { createSupabaseAiNewsStateStore } from "@site/public-data/ai-news/state.mjs";

function createAdminClient() {
  return getAdminSupabaseClient("每日动态同步只能在服务端运行。");
}

export function authorizeAiNewsCron(secret: string | null) {
  return Effect.gen(function* () {
    const client = yield* attempt("ai-news.admin", createAdminClient);
    return yield* createSupabaseAiNewsStateStore(client).isAuthorized(secret);
  });
}

export function runAiNewsCron(backfill = false) {
  return Effect.gen(function* () {
    const client = yield* attempt("ai-news.admin", createAdminClient);
    return yield* syncAiNews({
      backfill,
      clientFactory: () => client,
      stateStore: createSupabaseAiNewsStateStore(client),
    });
  });
}

export function readAiNewsCronHealth() {
  return Effect.gen(function* () {
    const client = yield* attempt("ai-news.admin", createAdminClient);
    return toPublicAiNewsHealth(yield* createSupabaseAiNewsStateStore(client).health());
  });
}
