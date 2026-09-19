import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
export const BIGMODEL_BASE_URL: string;
export const BIGMODEL_PROVIDER: string;
export const BIGMODEL_DEFAULT_MODEL: string;
export function resolveBigModel(model?: string): string;
export function requireBigModelApiKey(env?: NodeJS.ProcessEnv): string;
export function configureBigModelRuntime(runtime: ModelRuntime, model: string, env?: NodeJS.ProcessEnv): Promise<void>;
