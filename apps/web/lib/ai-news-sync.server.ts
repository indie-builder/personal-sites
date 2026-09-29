import "server-only";

import { getAdminSupabaseClient } from "@/lib/supabase.server";
import { syncAiNews } from "@site/public-data/ai-news/sync.mjs";
import { toPublicAiNewsHealth } from "@site/public-data/ai-news/public-health.mjs";
import { createSupabaseAiNewsStateStore } from "@site/public-data/ai-news/state.mjs";

function createAdminClient() {
  return getAdminSupabaseClient("每日动态同步只能在服务端运行。");
}

export async function authorizeAiNewsCron(secret: string | null) {
  return createSupabaseAiNewsStateStore(createAdminClient()).isAuthorized(
    secret,
  );
}

export async function runAiNewsCron(backfill = false) {
  const client = createAdminClient();
  return syncAiNews({
    backfill,
    clientFactory: () => client,
    stateStore: createSupabaseAiNewsStateStore(client),
  });
}

export async function readAiNewsCronHealth() {
  return toPublicAiNewsHealth(await createSupabaseAiNewsStateStore(createAdminClient()).health());
}
