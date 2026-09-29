import { BIGMODEL_BASE_URL, BIGMODEL_PROVIDER, resolveBigModel, requireBigModelApiKey } from "../../../config/bigmodel.mjs";

/**
 * Pi is the transport runtime; all analysis uses the shared BigModel provider.
 */
export function resolvePiModelConfig({ config = {}, env = process.env } = {}) {
  const ai = config.ai ?? {};
  return {
    model: resolveBigModel(env.BIGMODEL_MODEL || ai.model),
    provider: BIGMODEL_PROVIDER,
  };
}

/** 去掉模型回复外围的 markdown 代码围栏（json/text/markdown 均可），返回正文。 */
export function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json|text|markdown)?\s*/iu, "").replace(/\s*```$/u, "");
}

export async function configureBigModelRuntime(runtime, model, env = process.env) {
  const id = resolveBigModel(model);
  const key = requireBigModelApiKey(env);
  runtime.registerProvider(BIGMODEL_PROVIDER, {
    baseUrl: BIGMODEL_BASE_URL, api: "anthropic-messages", authHeader: true,
    models: [{ id, name: id, reasoning: false, input: ["text", "image"],
      contextWindow: 200_000, maxTokens: 8_192,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
  });
  await runtime.setRuntimeApiKey(BIGMODEL_PROVIDER, key);
}
