/** Provider-neutral extraction from the final Pi assistant message. */
export function getFinalAssistantText(session) {
  const message = session.state?.messages?.at(-1);
  if (message?.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .filter((content) => content?.type === "text" && typeof content.text === "string")
    .map((content) => content.text).join("").trim();
}

export function getFinalAssistantFailure(session) {
  const message = session.state?.messages?.at(-1);
  if (message?.role !== "assistant" || (message.stopReason !== "error" && message.stopReason !== "aborted")) return "";
  return message.errorMessage || `模型请求以 ${message.stopReason} 结束。`;
}
