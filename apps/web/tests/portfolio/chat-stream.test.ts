// @vitest-environment node
import { test, vi } from "vitest";
import assert from 'node:assert/strict';
import { createChatStream } from "../../lib/portfolio/chat-stream";

// Failure modes: delayed first content, missing final/aborted chunks, split Unicode,
// continuous deltas starving updates, duplicate flushes and callbacks after unmount.
function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const updates: string[] = [];
  const stream = createChatStream((text: string) => updates.push(text));
  return { stream, updates };
}

test('first content appears immediately; subsequent chunks coalesce without losing text', () => {
  const { stream, updates } = setup();
  stream.append('你');
  assert.deepEqual(updates, ['你']);
  stream.append('好');
  stream.append('\ud83d');
  stream.append('\ude00');
  vi.advanceTimersByTime(31);
  assert.deepEqual(updates, ['你']);
  vi.advanceTimersByTime(1);
  assert.deepEqual(updates, ['你', '你好😀']);
});

test('continuous deltas cannot postpone rendering indefinitely', () => {
  const { stream, updates } = setup();
  stream.append('a');
  stream.append('b');
  vi.advanceTimersByTime(16);
  stream.append('c');
  vi.advanceTimersByTime(16);
  assert.deepEqual(updates, ['a', 'abc']);
  stream.append('d');
  vi.advanceTimersByTime(32);
  assert.equal(updates.at(-1), 'abcd');
});

test('completion, error or stop flushes trailing content once and cancels its timer', () => {
  const { stream, updates } = setup();
  stream.append('first');
  stream.append(' last');
  stream.flush();
  stream.flush();
  vi.advanceTimersByTime(100);
  assert.deepEqual(updates, ['first', 'first last']);
});

test('empty streams never create an assistant message', () => {
  const { stream, updates } = setup();
  stream.append('');
  stream.flush();
  vi.advanceTimersByTime(100);
  assert.deepEqual(updates, []);
});

test('unmount discards pending callbacks and cannot affect a subsequent stream', () => {
  const { stream, updates } = setup();
  stream.append('old');
  stream.append(' pending');
  stream.cancel();
  stream.append(' late');
  stream.flush();
  const next = createChatStream((text: string) => updates.push(text));
  next.append('new');
  vi.advanceTimersByTime(100);
  assert.deepEqual(updates, ['old', 'new']);
});

test('1000 one-millisecond deltas preserve output with at most 33 update callbacks', () => {
  const { stream, updates } = setup();
  const chunks = Array.from({ length: 1000 }, (_, i) => `${i}中`);
  for (const chunk of chunks) {
    stream.append(chunk);
    vi.advanceTimersByTime(1);
  }
  stream.flush();
  assert.equal(updates.at(-1), chunks.join(''));
  assert(updates.length <= 33, `${updates.length} updates`);
  // 断言口径：fake timer 工作量，不测量 React 提交或浏览器帧率。
});
