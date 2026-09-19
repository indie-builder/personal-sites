import { BIGMODEL_BASE_URL, BIGMODEL_PROVIDER, requireBigModelApiKey, resolveBigModel } from "./bigmodel.mjs";

/** Ask and offline analysis share the same provider, endpoint and credential. */
export function resolveAskModelConfig(env = process.env) {
  const model = resolveBigModel(env.ASK_MODEL?.trim() || env.BIGMODEL_MODEL);
  return {
    provider: BIGMODEL_PROVIDER,
    model,
    baseUrl: BIGMODEL_BASE_URL,
  };
}

export function requireAskApiKey(env = process.env) {
  return requireBigModelApiKey(env);
}
