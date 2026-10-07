// @vitest-environment node
import { APICallError } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { Effect, Exit } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  model: vi.fn(),
  session: { summary: "", turns: [] as { question: string; answer: string }[] },
  uploaded: vi.fn(async (_key: string, _contents: string) => ({ error: null })),
}));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => mocks.model }));
vi.mock("@/lib/ask-limiter.server", () => ({ checkAskRateLimit: () => Effect.succeed({ allowed: true }) }));
vi.mock("@/lib/ask-search.server", () => ({ searchAskDocuments: () => Effect.succeed([
  { id: "fixture", title: "公开来源", content: "公开资料" },
]) }));
vi.mock("@/lib/supabase.server", () => ({ getAdminSupabaseClient: () => ({ storage: { from: () => ({
  download: async () => ({ data: new Blob([JSON.stringify(mocks.session)]), error: null }),
  list: async () => ({ data: [], error: null }),
  upload: mocks.uploaded,
}) } }) }));

import { streamAskAnswer } from "@/lib/ask-session.server";
import { POST } from "@/app/api/ask/route";

const request = { conversationId: "fixture", visitorId: "fixture", question: "问题", sources: [], onText: vi.fn() };
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const retryableError = () => new APICallError({
  message: "fixture unavailable", url: "https://fixture.invalid", requestBodyValues: {},
  statusCode: 503, isRetryable: true, responseHeaders: { "retry-after-ms": "0" },
});

function streamingModel(complete = false) {
  const ready = Promise.withResolvers<AbortSignal>();
  const aborted = vi.fn();
  let close = () => {};
  const model = new MockLanguageModelV3({ doStream: async ({ abortSignal }) => {
    if (!abortSignal) throw new Error("model cancellation signal required");
    return { stream: new ReadableStream({ start(controller) {
      close = () => controller.close();
      abortSignal.addEventListener("abort", () => {
        aborted();
        if (!complete) controller.error(abortSignal.reason);
      }, { once: true });
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "text-start", id: "0" });
      controller.enqueue({ type: "text-delta", id: "0", delta: "回答" });
      if (complete) {
        controller.enqueue({ type: "text-end", id: "0" });
        controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage });
        controller.close();
      }
      ready.resolve(abortSignal);
    } }) };
  } });
  mocks.model.mockReturnValue(model);
  return { ready: ready.promise, aborted, close: () => close() };
}

beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("ASK_SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("BIGMODEL_API_KEY", "fixture");
  vi.stubEnv("ASK_MODEL", "");
  vi.stubEnv("BIGMODEL_MODEL", "");
  mocks.session = { summary: "", turns: [] };
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each([false, true])("aborts the model transport and preserves history when cancellation also has an explicit signal %s", async (explicitSignal) => {
  const fixture = streamingModel();
  const controller = new AbortController();
  const pending = Effect.runPromiseExit(streamAskAnswer({ ...request, ...(explicitSignal ? { signal: controller.signal } : {}) }), { signal: controller.signal });
  const modelSignal = await fixture.ready;
  controller.abort();
  const exit = await pending;
  try {
    expect(Exit.isFailure(exit)).toBe(true);
    expect(modelSignal.aborted).toBe(true);
    expect(fixture.aborted).toHaveBeenCalledTimes(1);
    expect(mocks.uploaded).not.toHaveBeenCalled();
  } finally {
    if (!modelSignal.aborted) fixture.close();
  }
  const next = streamingModel(true);
  await Effect.runPromise(streamAskAnswer(request));
  expect(next.aborted).toHaveBeenCalledTimes(1);
  expect(mocks.uploaded.mock.calls[0]?.[1]).toBe(JSON.stringify({ summary: "", turns: [{ question: "问题", answer: "回答" }] }) + "\n");
});

it("aborts the model transport when the text consumer throws and saves no partial answer", async () => {
  const fixture = streamingModel();
  const requestController = new AbortController();
  const pending = Effect.runPromiseExit(streamAskAnswer({ ...request, signal: requestController.signal, onText: () => { throw new Error("consumer failed"); } }));
  const modelSignal = await fixture.ready;
  const exit = await pending;
  try {
    expect(Exit.isFailure(exit)).toBe(true);
    expect(modelSignal.aborted).toBe(true);
    expect(requestController.signal.aborted).toBe(false);
    expect(fixture.aborted).toHaveBeenCalledTimes(1);
    expect(mocks.uploaded).not.toHaveBeenCalled();
  } finally {
    if (!modelSignal.aborted) fixture.close();
  }
});

it("cancels the real SDK model transport through the POST response reader", async () => {
  const fixture = streamingModel();
  const request = new Request("http://localhost/api/ask", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId: "visitor-1234567890", conversationId: "conversation-1234567890", question: "公开资料", scope: "all" }),
  });
  const response = await POST(request);
  const modelSignal = await fixture.ready;
  const reader = response.body?.getReader();
  expect(reader).toBeDefined();
  expect(new TextDecoder().decode((await reader?.read())?.value)).toContain("event: text");
  await reader?.cancel();
  expect(modelSignal.aborted).toBe(true);
  expect(fixture.aborted).toHaveBeenCalledTimes(1);
  expect(request.signal.aborted).toBe(false);
  expect(mocks.uploaded).not.toHaveBeenCalled();
});

it("attempts a failed streaming model call only once", async () => {
  const model = new MockLanguageModelV3({ doStream: async () => { throw retryableError(); } });
  mocks.model.mockReturnValue(model);
  const exit = await Effect.runPromiseExit(streamAskAnswer(request));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(mocks.uploaded).not.toHaveBeenCalled();
});

it("attempts a failed compaction only once and preserves the original session", async () => {
  vi.stubEnv("ASK_COMPACT_AFTER_CHARACTERS", "1");
  mocks.session.turns = Array.from({ length: 5 }, () => ({ question: "旧问题", answer: "旧回答" }));
  const original = structuredClone(mocks.session);
  const model = new MockLanguageModelV3({ doGenerate: async () => { throw retryableError(); } });
  mocks.model.mockReturnValue(model);
  const exit = await Effect.runPromiseExit(streamAskAnswer(request));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(model.doGenerateCalls).toHaveLength(1);
  expect(model.doStreamCalls).toHaveLength(0);
  expect(mocks.uploaded).not.toHaveBeenCalled();
  expect(mocks.session).toEqual(original);
});
