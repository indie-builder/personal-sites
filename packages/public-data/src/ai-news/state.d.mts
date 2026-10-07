import type { Effect } from "effect";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiNewsSyncStats = {
  backfill: boolean;
  modes: Record<string, { changed: boolean; count: number | null }>;
  publicCount: number;
  skipped: boolean;
};

export type AiNewsLeaseToken = {
  startedAt: string;
  leaseUntil: string;
};

export type AiNewsStateStore = {
  acquire(options: { now: Date }): Effect.Effect<
    | { acquired: true; etags: Record<string, string | null>; token: AiNewsLeaseToken }
    | { acquired: false; etags: Record<string, string | null> },
    Error
  >;
  assertOwned(options: { token: AiNewsLeaseToken; now: Date }): Effect.Effect<void, Error>;
  fail(options: { token: AiNewsLeaseToken; error: unknown }): Effect.Effect<void, Error>;
  health(options?: { now?: Date; staleAfterMinutes?: number }): Effect.Effect<
    {
      ageMinutes: number | null;
      healthy: boolean;
      lastError: string | null;
      lastStartedAt: string | null;
      lastSucceededAt: string | null;
      running: boolean;
    },
    Error
  >;
  isAuthorized(secret: string | null): Effect.Effect<boolean, Error>;
  succeed(options: {
    token: AiNewsLeaseToken;
    completedAt?: Date;
    etags: Record<string, string | null>;
    stats: AiNewsSyncStats;
  }): Effect.Effect<void, Error>;
};

export function createSupabaseAiNewsStateStore(client: SupabaseClient): AiNewsStateStore;
