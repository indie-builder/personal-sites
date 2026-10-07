import { Effect } from "effect";
import { io } from "@site/effect";
import { createHash, timingSafeEqual } from "node:crypto";

const STATE_ID = "default";
const LEASE_MS = 4 * 60 * 1000;

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

function sameHash(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSupabaseAiNewsStateStore(client) {
  return {
    acquire({ now }) {
      return Effect.gen(function* () {
        const startedAt = now.toISOString();
        const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
        const { data, error } = yield* io("ai-news.acquire", (signal) =>
          client
            .from("ai_news_sync_state")
            .update({
              last_error: null,
              last_started_at: startedAt,
              lease_until: leaseUntil,
            })
            .eq("id", STATE_ID)
            .or(`lease_until.is.null,lease_until.lt.${startedAt}`)
            .select("etags")
            .maybeSingle()
            .abortSignal(signal),
        );
        if (error) return yield* Effect.fail(new Error(`获取每日动态同步租约失败：${error.message}`));
        return data
          ? { acquired: true, etags: data.etags ?? {}, token: { startedAt, leaseUntil } }
          : { acquired: false, etags: {} };
      });
    },

    assertOwned({ token, now }) {
      return Effect.gen(function* () {
        const { data, error } = yield* io("ai-news.owner", (signal) =>
          client
            .from("ai_news_sync_state")
            .select("id")
            .eq("id", STATE_ID)
            .eq("last_started_at", token.startedAt)
            .eq("lease_until", token.leaseUntil)
            .gt("lease_until", now.toISOString())
            .maybeSingle()
            .abortSignal(signal),
        );
        if (error) return yield* Effect.fail(new Error(`读取每日动态同步租约失败：${error.message}`));
        if (!data) return yield* Effect.fail(new Error("每日动态同步租约已失效。"));
      });
    },

    succeed({ token, completedAt = new Date(), etags, stats }) {
      return Effect.gen(function* () {
        const { data, error } = yield* io("ai-news.succeed", (signal) =>
          client
            .from("ai_news_sync_state")
            .update({
              etags,
              last_error: null,
              last_stats: stats,
              last_succeeded_at: completedAt.toISOString(),
              lease_until: null,
            })
            .eq("id", STATE_ID)
            .eq("last_started_at", token.startedAt)
            .eq("lease_until", token.leaseUntil)
            .select("id")
            .abortSignal(signal),
        );
        if (error) return yield* Effect.fail(new Error(`记录每日动态同步成功状态失败：${error.message}`));
        if (!data?.length) return yield* Effect.fail(new Error("每日动态同步租约已失效。"));
      });
    },

    fail({ token, error }) {
      return Effect.gen(function* () {
        const { error: stateError } = yield* io("ai-news.fail", (signal) =>
          client
            .from("ai_news_sync_state")
            .update({
              last_error: String(error?.message ?? error).slice(0, 1000),
              last_stats: {},
              lease_until: null,
            })
            .eq("id", STATE_ID)
            .eq("last_started_at", token.startedAt)
            .eq("lease_until", token.leaseUntil)
            .select("id")
            .abortSignal(signal),
        );
        if (stateError) return yield* Effect.fail(new Error(`记录每日动态同步失败状态失败：${stateError.message}`));
      });
    },

    isAuthorized(secret) {
      return Effect.gen(function* () {
        if (!secret) return false;
        const { data, error } = yield* io("ai-news.isAuthorized", (signal) =>
          client.from("ai_news_sync_state").select("cron_secret_hash").eq("id", STATE_ID).maybeSingle()
            .abortSignal(signal),
        );
        if (error) return yield* Effect.fail(new Error(`读取每日动态 Cron 密钥摘要失败：${error.message}`));
        return Boolean(data?.cron_secret_hash && sameHash(hashSecret(secret), data.cron_secret_hash));
      });
    },

    health({ now = new Date(), staleAfterMinutes = 20 } = {}) {
      return Effect.gen(function* () {
        const { data, error } = yield* io("ai-news.health", (signal) =>
          client
            .from("ai_news_sync_state")
            .select("last_error,last_succeeded_at,last_started_at,lease_until")
            .eq("id", STATE_ID)
            .maybeSingle()
            .abortSignal(signal),
        );
        if (error) return yield* Effect.fail(new Error(`读取每日动态同步健康状态失败：${error.message}`));
        const ageMinutes = data?.last_succeeded_at
          ? Math.max(0, Math.round((now.getTime() - Date.parse(data.last_succeeded_at)) / 60_000))
          : null;
        return {
          ageMinutes,
          healthy: ageMinutes !== null && ageMinutes <= staleAfterMinutes && !data?.last_error,
          lastError: data?.last_error ?? null,
          lastStartedAt: data?.last_started_at ?? null,
          lastSucceededAt: data?.last_succeeded_at ?? null,
          running: Boolean(data?.lease_until && Date.parse(data.lease_until) > now.getTime()),
        };
      });
    },
  };
}
