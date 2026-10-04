// @vitest-environment node
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blockFirst: false, model: vi.fn(() => ({})), provider: vi.fn(),
  started: vi.fn(), uploaded: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/supabase.server", () => ({ getAdminSupabaseClient: () => ({ storage: { from: () => ({
  download: async () => ({ data: null, error: { statusCode: "404" } }),
  list: async () => ({ data: [], error: null }),
  upload: mocks.uploaded,
}) } }) }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: (options: unknown) => {
  mocks.provider(options);
  return mocks.model;
} }));
vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: ({ abortSignal }: { abortSignal: AbortSignal }) => ({
    finishReason: Promise.resolve("stop"),
    textStream: (async function* () {
      const turn = mocks.started.mock.calls.length;
      mocks.started();
      if (mocks.blockFirst && turn === 0) await new Promise<void>((_resolve, reject) => {
        abortSignal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
      yield "回答";
    })(),
  }),
}));
beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("ASK_SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("BIGMODEL_API_KEY", "fixture");
  vi.stubEnv("BIGMODEL_MODEL", "");
  vi.stubEnv("ASK_MODEL", "");
});
afterEach(() => { mocks.blockFirst = false; vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("cancelling a turn releases the session permit for the next turn and preserves only completed answers", async () => {
  mocks.blockFirst = true;
  const { streamAskAnswer } = await import("@/lib/ask-session.server");
  const controller = new AbortController();
  const request = { conversationId: "conversation", visitorId: "visitor", question: "问题", sources: [], onText: vi.fn() };
  const first = Effect.runPromiseExit(streamAskAnswer({ ...request, signal: controller.signal }), { signal: controller.signal });
  await vi.waitFor(() => expect(mocks.started).toHaveBeenCalledTimes(1));
  const next = Effect.runPromise(streamAskAnswer(request));
  controller.abort();
  await first;
  await next;
  expect(mocks.started).toHaveBeenCalledTimes(2);
  expect(request.onText).toHaveBeenCalledExactlyOnceWith("回答");
  expect(mocks.uploaded).toHaveBeenCalledTimes(1);
});

it.each([
  [" glm-5.3 ", "glm-5.3-flash", "glm-5.3"],
  [" ", "glm-5.3", "glm-5.3"],
  ["", "", "glm-5.3-flash"],
])("streams with Ask model %s and shared model %s", async (askModel, sharedModel, expected) => {
  vi.stubEnv("ASK_MODEL", askModel);
  vi.stubEnv("BIGMODEL_MODEL", sharedModel);
  const { streamAskAnswer } = await import("@/lib/ask-session.server");
  await Effect.runPromise(streamAskAnswer({
    conversationId: "conversation", visitorId: "visitor", question: "问题", sources: [], onText: vi.fn(),
  }));
  expect(mocks.provider).toHaveBeenCalledExactlyOnceWith({
    baseURL: "https://open.bigmodel.cn/api/anthropic/v1", apiKey: "fixture",
  });
  expect(mocks.model).toHaveBeenCalledExactlyOnceWith(expected);
});

it("fails before invoking the model when its configuration is invalid", async () => {
  vi.stubEnv("ASK_MODEL", "invalid-model");
  const { streamAskAnswer } = await import("@/lib/ask-session.server");
  await expect(Effect.runPromise(streamAskAnswer({
    conversationId: "conversation", visitorId: "visitor", question: "问题", sources: [], onText: vi.fn(),
  }))).rejects.toThrow(/GLM/);
  expect(mocks.provider).not.toHaveBeenCalled();
});
