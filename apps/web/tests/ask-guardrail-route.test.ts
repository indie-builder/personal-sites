// @vitest-environment node
import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardrail: vi.fn(),
  searched: vi.fn(),
}));
vi.mock("@/lib/ask-limiter.server", () => ({ checkAskRateLimit: () => Effect.succeed({ allowed: true }) }));
vi.mock("@/lib/ask-guardrail.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ask-guardrail.server")>()),
  checkAskGuardrail: mocks.guardrail,
}));
vi.mock("@/lib/ask-search.server", () => ({
  searchAskDocuments: () => {
    mocks.searched();
    return Effect.succeed([{ id: "fixture", title: "公开来源", content: "x", publishedAt: null, scope: "profile", section: null, sourceId: "s", sourceUrl: "u" }]);
  },
}));
vi.mock("@/lib/ask-session.server", () => ({
  streamAskAnswer: ({ onText }: { onText: (text: string) => void }) => Effect.sync(() => onText("回答")),
}));

import { Route } from "../src/routes/api/ask";

const POST = (Route.options.server!.handlers as { POST: (ctx: { request: Request }) => Response | Promise<Response> }).POST;
const request = () =>
  POST({
    request: new Request("http://localhost/api/ask", {
      body: JSON.stringify({ conversationId: "c".repeat(20), question: "你的工程经历是什么？", scope: "all", visitorId: "v".repeat(20) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  });

afterEach(() => vi.clearAllMocks());

it("returns 400 with the guardrail message and never searches when blocked", async () => {
  mocks.guardrail.mockReturnValue(Effect.succeed({ action: "block", probabilities: {}, reason: "jailbreak" }));
  const response = await request();
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("无法处理");
  expect(mocks.searched).not.toHaveBeenCalled();
});

it("proceeds to search and streams when the guardrail passes", async () => {
  mocks.guardrail.mockReturnValue(Effect.succeed({ action: "pass" }));
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("回答");
  expect(mocks.searched).toHaveBeenCalled();
});

it("fails open and still answers when the guardrail errors", async () => {
  mocks.guardrail.mockReturnValue(Effect.fail(new Error("guardrail down")));
  const response = await request();
  expect(response.status).toBe(200);
  expect(mocks.searched).toHaveBeenCalled();
});
