import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAdminSupabaseClient, requiredEnv } from "@/lib/supabase.server";

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
});

function getRateLimitClient() {
  return getAdminSupabaseClient("无法执行公开问答共享限流。");
}

export async function checkAskRateLimit(ip: string, now = Date.now(), client: SupabaseClient = getRateLimitClient()) {
  const ipHash = createHmac("sha256", requiredEnv("ASK_SESSION_SECRET", "无法执行公开问答共享限流。")).update(ip).digest("hex");
  const { data, error } = await client.rpc("check_ask_rate_limit", {
    p_ip_hash: ipHash,
    p_now: new Date(now).toISOString(),
  });
  if (error) throw new Error(`执行公开问答共享限流失败：${error.message}`);
  const result = rateLimitResultSchema.parse(data?.[0]);
  return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
}
