// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ answer: vi.fn(), sources: [] as unknown[] }));
vi.mock("@/lib/ask-limiter.server", () => ({ checkAskRateLimit: () => Effect.succeed({ allowed: true }) }));
vi.mock("@/lib/ask-search.server", () => ({ searchAskDocuments: () => Effect.succeed(mocks.sources) }));
vi.mock("@/lib/ask-session.server", () => ({ streamAskAnswer: (options: { onText: (text: string) => void; format?: string }) => Effect.sync(() => {
  mocks.answer(options.format);
  options.onText(options.format === "openui" ? 'root = Stack([TextContent("回答")])' : "回答");
}) }));

import { POST } from "@/app/api/ask/route";

beforeEach(() => { mocks.sources = []; mocks.answer.mockClear(); });
const request = (format?: string) => new Request("http://localhost/api/ask", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ visitorId: "visitor-1234567890", conversationId: "conversation-1234567890", question: "公开资料", scope: "all", ...(format ? { format } : {}) }),
});

it.each([undefined, "openui"])("formats the no-results response for %s without calling a model", async (format) => {
  const response = await POST(request(format));
  const text = await response.text();
  expect(text.includes("root = Stack")).toBe(format === "openui");
  expect(text).toContain("现有公开资料不足以确认");
  expect(text.indexOf("event: text")).toBeLessThan(text.indexOf("event: sources"));
  expect(text.indexOf("event: sources")).toBeLessThan(text.indexOf("event: done"));
  expect(mocks.answer).not.toHaveBeenCalled();
});

it.each([undefined, "openui"])("preserves the requested output format and SSE order for %s", async (format) => {
  mocks.sources = [{ id: "public-source", title: "公开来源" }];
  const response = await POST(request(format));
  const text = await response.text();
  expect(mocks.answer).toHaveBeenCalledWith(format);
  expect(text.includes("root = Stack")).toBe(format === "openui");
  expect(text.indexOf("event: text")).toBeLessThan(text.indexOf("event: sources"));
  expect(text.indexOf("event: sources")).toBeLessThan(text.indexOf("event: done"));
});

it("rejects unknown output formats", async () => {
  expect((await POST(request("html"))).status).toBe(400);
});
