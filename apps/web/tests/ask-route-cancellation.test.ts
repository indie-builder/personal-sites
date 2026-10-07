// @vitest-environment node
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blockSearch: false,
  ready: Promise.withResolvers<AbortSignal>(),
  stopped: vi.fn(),
  finished: vi.fn(),
  answer: vi.fn(),
}));
vi.mock("@/lib/ask-limiter.server", () => ({ checkAskRateLimit: () => Effect.succeed({ allowed: true }) }));
const blocked = () => Effect.tryPromise((signal) => {
  mocks.ready.resolve(signal);
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      mocks.stopped();
      reject(signal.reason);
    }, { once: true });
  });
}).pipe(Effect.ensuring(Effect.sync(() => mocks.finished())));
vi.mock("@/lib/ask-search.server", () => ({ searchAskDocuments: () => mocks.blockSearch
  ? blocked()
  : Effect.succeed([{ id: "fixture", title: "公开来源" }]),
}));
vi.mock("@/lib/ask-session.server", () => ({ streamAskAnswer: () => {
  mocks.answer();
  return blocked();
} }));

import { POST } from "@/app/api/ask/route";

beforeEach(() => {
  mocks.ready = Promise.withResolvers<AbortSignal>();
  mocks.blockSearch = false;
});
afterEach(() => vi.clearAllMocks());

it.each([false, true])("cancelling the SSE body interrupts the producer while search is pending %s", async (blockSearch) => {
  mocks.blockSearch = blockSearch;
  const request = new Request("http://localhost/api/ask", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId: "visitor-1234567890", conversationId: "conversation-1234567890", question: "公开资料", scope: "all" }),
  });
  const response = await POST(request);
  const producerSignal = await mocks.ready.promise;
  const reader = response.body?.getReader();
  expect(reader).toBeDefined();
  await reader?.cancel();
  expect(request.signal.aborted).toBe(false);
  expect(producerSignal.aborted).toBe(true);
  expect(mocks.stopped).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(mocks.finished).toHaveBeenCalledTimes(1));
  expect(mocks.answer).toHaveBeenCalledTimes(blockSearch ? 0 : 1);
});
