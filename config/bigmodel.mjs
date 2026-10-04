export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
export const BIGMODEL_PROVIDER = "bigmodel-coding";
const BIGMODEL_DEFAULT_MODEL = "glm-5.3-flash";

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
