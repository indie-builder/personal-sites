import { BIGMODEL_PROVIDER, resolveBigModel } from "./bigmodel.mjs";

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
