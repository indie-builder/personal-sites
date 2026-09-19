export function resolveAskModelConfig(env?: NodeJS.ProcessEnv): {
  provider: string;
  model: string;
  baseUrl: string;
};
export function requireAskApiKey(env?: NodeJS.ProcessEnv): string;
