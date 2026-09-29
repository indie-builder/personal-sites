import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
export function resolvePiModelConfig(options?: {
  config?: { ai?: { model?: string; provider?: string } };
  env?: NodeJS.ProcessEnv;
}): { model: string; provider: string };

export function configureBigModelRuntime(runtime: ModelRuntime, model: string, env?: NodeJS.ProcessEnv): Promise<void>;
