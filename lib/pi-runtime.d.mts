export function resolvePiModelConfig(options?: {
  config?: { ai?: { model?: string; provider?: string } };
  env?: NodeJS.ProcessEnv;
}): { model: string; provider: string };
