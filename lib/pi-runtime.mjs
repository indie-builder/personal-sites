const DEFAULT_PROVIDER = "kimi-coding";
const DEFAULT_MODEL = "kimi-for-coding";

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "";
}

/**
 * Resolve the shared Pi Coding Agent model configuration. Kimi remains the
 * default while local development can override either provider or model.
 */
export function resolvePiModelConfig({ config = {}, env = process.env } = {}) {
  const ai = config.ai ?? {};
  return {
    model: firstDefined(env.PI_MODEL, ai.model, DEFAULT_MODEL),
    provider: firstDefined(env.PI_PROVIDER, ai.provider, DEFAULT_PROVIDER),
  };
}

export function getFinalAssistantText(session) {
  const message = session.state?.messages?.at(-1);
  if (message?.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .filter((content) => content?.type === "text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("")
    .trim();
}

export function getFinalAssistantFailure(session) {
  const message = session.state?.messages?.at(-1);
  if (message?.role !== "assistant" || (message.stopReason !== "error" && message.stopReason !== "aborted")) return "";
  return message.errorMessage || `Kimi 请求以 ${message.stopReason} 结束。`;
}

/** 去掉模型回复外围的 markdown 代码围栏（json/text/markdown 均可），返回正文。 */
export function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json|text|markdown)?\s*/iu, "").replace(/\s*```$/u, "");
}
