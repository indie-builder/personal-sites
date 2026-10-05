import { createClient } from "@supabase/supabase-js";

/** 服务端脚本共用的 Supabase 服务客户端：禁用令牌自动刷新与会话持久化。 */
export function createSupabaseServiceClient(url, serviceRoleKey, clientFactory = createClient) {
  return clientFactory(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
