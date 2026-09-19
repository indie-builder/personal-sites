import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY", purpose: string) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；${purpose}`);
  return value;
}

function createSupabaseClient(key: "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY", purpose: string): SupabaseClient {
  return createClient(requiredEnvironment("SUPABASE_URL", purpose), requiredEnvironment(key, purpose), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const clientCache = new Map<"admin" | "public", SupabaseClient>();

function getCachedSupabaseClient(key: "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY", purpose: string): SupabaseClient {
  const slot = key === "SUPABASE_SERVICE_ROLE_KEY" ? "admin" : "public";
  let client = clientCache.get(slot);
  if (!client) {
    client = createSupabaseClient(key, purpose);
    clientCache.set(slot, client);
  }
  return client;
}

/** 公开投影只读客户端（publishable key）；调用方传入缺 key 时的诊断文案。 */
export function getPublicSupabaseClient(purpose: string): SupabaseClient {
  return getCachedSupabaseClient("SUPABASE_PUBLISHABLE_KEY", purpose);
}

/** 服务端管理客户端（service role key），只允许在服务端同步/持久化路径使用。 */
export function getAdminSupabaseClient(purpose: string): SupabaseClient {
  return getCachedSupabaseClient("SUPABASE_SERVICE_ROLE_KEY", purpose);
}

/** 读取业务自身必需的环境变量，缺失时抛出带诊断文案的错误。 */
export function requiredEnv(key: string, purpose: string) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；${purpose}`);
  return value;
}
