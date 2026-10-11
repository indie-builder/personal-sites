// @vitest-environment node
import { Schema } from "effect";
import { expect, test } from "vitest";
import { defaultAgent, formStateTooLarge, parseMessage, parseSavedChat, requestSchema } from "../../lib/portfolio/chat/model";

const message = (formState: Record<string, unknown>) => ({
  id: "question", role: "user", text: "公开问题", metadata: { submission: { formState } },
});

test("ordinary questions do not require form submission state", () => {
  expect(formStateTooLarge(undefined)).toBe(false);
  expect(formStateTooLarge(null)).toBe(false);
  expect(parseMessage({ id: "question", role: "user", text: "公开问题" }).text).toBe("公开问题");
});

test("submitted form state retains the request size limit", () => {
  expect(formStateTooLarge({ answer: "hello" })).toBe(false);
  expect(formStateTooLarge({ answer: "a".repeat(60_000) })).toBe(true);
});

test("oversized submissions are rejected before persistence and when restoring history", () => {
  const invalid = message({ answer: "a".repeat(60_000) });
  expect(() => parseMessage(invalid)).toThrow();
  expect(() => parseSavedChat({
    agents: [defaultAgent],
    conversations: [{ id: "chat", agentId: defaultAgent.id, title: "test", messages: [invalid] }],
  })).toThrow();
  expect(Schema.decodeUnknownResult(requestSchema)({ agent: defaultAgent, messages: [invalid] })._tag).toBe("Failure");
});

test("cyclic and deeply nested form values become validation failures", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  expect(formStateTooLarge(cycle)).toBe(true);
  const nested = JSON.parse('{"a":'.repeat(12_000) + "0" + "}".repeat(12_000));
  expect(() => Schema.decodeUnknownResult(requestSchema)({ agent: defaultAgent, messages: [message(nested)] })).not.toThrow();
  expect(Schema.decodeUnknownResult(requestSchema)({ agent: defaultAgent, messages: [message(nested)] })._tag).toBe("Failure");
});
