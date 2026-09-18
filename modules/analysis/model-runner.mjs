import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { getFinalAssistantFailure, getFinalAssistantText } from "../../lib/pi-runtime.mjs";

/** 给模型请求加统一超时；超时或成功都会清掉定时器。 */
export async function awaitModelResponse(request, timeoutMilliseconds, { label } = {}) {
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1000) {
    throw new Error("模型请求超时必须是不小于 1000 的整数毫秒数。");
  }
  const requestLabel = label ? `${label} 请求` : "模型请求";
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${requestLabel}超时（${Math.round(timeoutMilliseconds / 1000)} 秒）。`)), timeoutMilliseconds);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 一次性的 Pi 模型调用：建会话 → 累积 text_delta → prompt → 校验失败 → 返回最终文本。
 * Some providers only expose the complete message when the turn ends, without
 * emitting text_delta events; prefer that authoritative result and keep the
 * streaming collector for providers that do stream.
 */
export async function runPiPrompt({
  cwd,
  images = [],
  label = "模型",
  model,
  prompt,
  runtime,
  timeoutMilliseconds,
}) {
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
  });
  await resourceLoader.reload();
  const { session } = await createAgentSession({
    cwd,
    model,
    modelRuntime: runtime,
    noTools: "all",
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
    thinkingLevel: "off",
  });
  let answer = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      answer += event.assistantMessageEvent.delta;
    }
  });
  try {
    const request = session.prompt(prompt, {
      images: images.map((image) => ({
        source: { data: image.data, mediaType: image.mediaType, type: "base64" },
        type: "image",
      })),
    });
    if (timeoutMilliseconds !== undefined) await awaitModelResponse(request, timeoutMilliseconds, { label });
    const failure = getFinalAssistantFailure(session);
    if (failure) throw new Error(`${label} 请求失败：${failure}`);
    return getFinalAssistantText(session) || answer.trim();
  } finally {
    unsubscribe();
    session.dispose();
  }
}
