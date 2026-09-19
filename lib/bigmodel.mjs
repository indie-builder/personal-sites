export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
export const BIGMODEL_PROVIDER = "bigmodel-coding";
export const BIGMODEL_DEFAULT_MODEL = "glm-5.3-flash";

export function resolveBigModel(model) {
  const value = model?.trim() || BIGMODEL_DEFAULT_MODEL;
  if (!/^glm-[a-z0-9.-]+(?:\[[a-z0-9]+\])?$/i.test(value)) throw new Error("模型必须是智谱 GLM 模型。");
  return value;
}

export function requireBigModelApiKey(env = process.env) {
  const key = env.BIGMODEL_API_KEY?.trim();
  if (!key) throw new Error("缺少 BIGMODEL_API_KEY，无法调用智谱模型。");
  return key;
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
