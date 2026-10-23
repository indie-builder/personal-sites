export const BIGMODEL_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
export const BIGMODEL_PROVIDER = "bigmodel-coding";
const BIGMODEL_DEFAULT_MODEL = "glm-5.3-flash";

// 生产智谱账户用 glm-* 模型名；本机模型网关用 provider/model 形式（如 group/flash）。
// 仍拒绝裸的非法名，让 Ask 在配置错误时尽早失败。
const MODEL_ID = /^(?:glm-[a-z0-9.-]+(?:\[[a-z0-9]+\])?|[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)$/i;

export function resolveBigModel(model) {
  const value = model?.trim() || BIGMODEL_DEFAULT_MODEL;
  if (!MODEL_ID.test(value)) throw new Error("模型必须是智谱 GLM 模型或 provider/model 形式。");
  return value;
}

// 本机可用 BIGMODEL_BASE_URL 指向模型网关；未设置时保持智谱生产端点（Vercel 上必须如此）。
export function resolveBigModelBaseUrl(env = process.env) {
  return env.BIGMODEL_BASE_URL?.trim() || BIGMODEL_BASE_URL;
}

export function requireBigModelApiKey(env = process.env) {
  const key = env.BIGMODEL_API_KEY?.trim();
  if (!key) throw new Error("缺少 BIGMODEL_API_KEY，无法调用智谱模型。");
  return key;
}
