import assert from "node:assert/strict";
import test from "node:test";
import { getFinalAssistantFailure, getFinalAssistantText } from "../lib/agent-response.mjs";

test("provider-neutral response extraction preserves text and reports failures", () => {
  const session = { state: { messages: [{ role: "assistant", content: [{ type: "thinking", text: "hidden" }, { type: "text", text: "回答【1】" }] }] } };
  assert.equal(getFinalAssistantText(session), "回答【1】");
  assert.equal(getFinalAssistantFailure(session), "");
  assert.equal(getFinalAssistantFailure({ state: { messages: [{ role: "assistant", stopReason: "error" }] } }), "模型请求以 error 结束。");
  assert.equal(getFinalAssistantText({ state: { messages: [{ role: "user", content: "question" }] } }), "");
});
