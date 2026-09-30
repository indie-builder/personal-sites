import type { Effect } from "effect";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
export function resolvePiModelConfig(options?: {
  config?: { ai?: { model?: string; provider?: string } };
  env?: NodeJS.ProcessEnv;
}): { model: string; provider: string };

export function configureBigModelRuntime(
  runtime: ModelRuntime,
  model: string,
  env?: NodeJS.ProcessEnv,
): Effect.Effect<void, Error>;
