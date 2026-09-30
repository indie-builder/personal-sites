import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Schema } from "effect";

import { getAdminSupabaseClient, requiredEnv } from "@/lib/supabase.server";

const rateLimitResultSchema = Schema.Struct({
  allowed: Schema.Boolean,
  retry_after_seconds: Schema.Number.pipe(Schema.finite()).pipe(Schema.int()).pipe(Schema.nonNegative()),
});

function getRateLimitClient() {
  return getAdminSupabaseClient("无法执行公开问答共享限流。");
}

export function checkAskRateLimit(ip: string, now = Date.now(), client?: SupabaseClient) {
  return Effect.gen(function* () {
    const sharedClient = client ?? (yield* attempt("ask.limiter.client", getRateLimitClient));
    const ipHash = yield* attempt("ask.limiter.identity", () =>
      createHmac("sha256", requiredEnv("ASK_SESSION_SECRET", "无法执行公开问答共享限流。")).update(ip).digest("hex"),
    );
    const { data, error } = yield* io("checkAskRateLimit", () =>
      sharedClient.rpc("check_ask_rate_limit", {
        p_ip_hash: ipHash,
        p_now: new Date(now).toISOString(),
      }),
    );
    if (error) return yield* Effect.fail(new Error(`执行公开问答共享限流失败：${error.message}`));
    const result = yield* Schema.decodeUnknown(rateLimitResultSchema)(data?.[0]);
    return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
  });
}
