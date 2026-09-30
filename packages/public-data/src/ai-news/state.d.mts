import type { Effect } from "effect";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiNewsSyncStats = {
  backfill: boolean;
  modes: Record<string, { changed: boolean; count: number | null }>;
  publicCount: number;
  skipped: boolean;
};

export type AiNewsStateStore = {
  acquire(options: {
    backfill?: boolean;
    now: Date;
  }): Effect.Effect<{ acquired: boolean; etags: Record<string, string | null> }, Error>;
  fail(error: unknown): Effect.Effect<void, Error>;
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
    completedAt?: Date;
    etags: Record<string, string | null>;
    stats: AiNewsSyncStats;
  }): Effect.Effect<void, Error>;
};

export function createSupabaseAiNewsStateStore(client: SupabaseClient): AiNewsStateStore;
