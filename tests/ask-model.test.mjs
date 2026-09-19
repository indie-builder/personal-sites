import assert from "node:assert/strict";
import test from "node:test";
import { requireAskApiKey, resolveAskModelConfig } from "../lib/ask-model.mjs";
import { readFileSync } from "node:fs";
import { getFinalAssistantFailure, getFinalAssistantText } from "../lib/agent-response.mjs";

test("Ask uses the explicitly selected BigModel endpoint independently of Pi curation", () => {
  assert.deepEqual(resolveAskModelConfig({ PI_PROVIDER: "kimi-coding", PI_MODEL: "kimi-for-coding" }), {
    provider: "bigmodel-coding", model: "glm-5.3-flash", baseUrl: "https://open.bigmodel.cn/api/anthropic",
  });
  assert.equal(resolveAskModelConfig({ ASK_MODEL: " glm-5.3 " }).model, "glm-5.3");
  assert.equal(resolveAskModelConfig({ ASK_MODEL: " " }).model, "glm-5.3-flash");
});

test("Ask never falls back to legacy credentials or legacy model configuration", () => {
  assert.throws(() => requireAskApiKey({ KIMI_API_KEY: "legacy-test-key" }), /BIGMODEL_API_KEY/);
  assert.equal(requireAskApiKey({ BIGMODEL_API_KEY: " new-test-key ", KIMI_API_KEY: "legacy-test-key" }), "new-test-key");
  assert.throws(() => resolveAskModelConfig({ ASK_MODEL: "kimi-for-coding" }), /GLM/);
  const source = readFileSync(new URL("../lib/ask-session.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /KIMI_API_KEY|pi-runtime|resolvePiModelConfig/);
  assert.match(source, /requireAskApiKey/);
});

test("provider-neutral response extraction preserves text and reports failures", () => {
  const session = { state: { messages: [{ role: "assistant", content: [{ type: "thinking", text: "hidden" }, { type: "text", text: "回答【1】" }] }] } };
  assert.equal(getFinalAssistantText(session), "回答【1】");
  assert.equal(getFinalAssistantFailure(session), "");
  assert.equal(getFinalAssistantFailure({ state: { messages: [{ role: "assistant", stopReason: "error" }] } }), "模型请求以 error 结束。");
  assert.equal(getFinalAssistantText({ state: { messages: [{ role: "user", content: "question" }] } }), "");
});
