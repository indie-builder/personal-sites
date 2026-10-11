// @vitest-environment node
import { test } from "vitest";
import assert from 'node:assert/strict';
import { chatErrorMessage } from "../../lib/portfolio/chat-error";
test('chat diagnostics keep cause and redact credentials without serializing payloads', () => {
  const old = process.env.BIGMODEL_API_KEY;
  process.env.BIGMODEL_API_KEY = 'fixture-private-key';
  try {
    const error = new Error(
      'provider 429: Bearer abc123 api_key="private-value" fixture-private-key sk-abcdefghijklmnopqrst',
    );
    (error as Error & { payload?: unknown }).payload = { prompt: 'private conversation' };
    const message = chatErrorMessage(error);
    assert.match(message, /provider 429/);
    for (const secret of [
      'abc123',
      'private-value',
      'fixture-private-key',
      'sk-abcdefghijklmnopqrst',
      'private conversation',
    ])
      assert(!message.includes(secret));
    assert.equal(chatErrorMessage({ payload: 'private conversation' }), 'Unknown error');
  } finally {
    if (old === undefined) delete process.env.BIGMODEL_API_KEY;
    else process.env.BIGMODEL_API_KEY = old;
  }
});
