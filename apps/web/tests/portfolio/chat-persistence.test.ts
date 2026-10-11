// @vitest-environment node
import { test, vi } from "vitest";
import assert from 'node:assert/strict';
import { createChatPersistence } from "../../lib/portfolio/chat-stream";

// Failure modes: lost trailing deltas, stale timer overwrites, indefinite debounce,
// missing lifecycle flushes, writes after disposal and repeated storage errors.
function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const writes: unknown[] = [];
  const errors: unknown[] = [];
  const persistence = createChatPersistence(
    (value: unknown) => writes.push(value),
    (error: unknown) => errors.push(error),
  );
  return { persistence, writes, errors };
}
const saved = (text: string) => ({
  agents: [],
  conversations: [{ id: 'chat', agentId: 'general', title: text, messages: [] }],
});

test('streaming writes the latest snapshot at bounded intervals, not every delta', () => {
  const { persistence, writes } = setup();
  assert.deepEqual(writes, []);
  const first = saved('first');
  const latest = saved('latest');
  persistence.schedule(first, true);
  vi.advanceTimersByTime(250);
  persistence.schedule(latest, true);
  vi.advanceTimersByTime(249);
  assert.equal(writes.length, 0);
  vi.advanceTimersByTime(1);
  assert.deepEqual(writes, [latest]);
  persistence.schedule(first, true);
  vi.advanceTimersByTime(500);
  assert.deepEqual(writes, [latest, first]);
});

test('completion or stop saves immediately and cancels the stale streaming timer', () => {
  const { persistence, writes } = setup();
  persistence.schedule(saved('partial'), true);
  const complete = saved('complete');
  persistence.schedule(complete, false);
  assert.deepEqual(writes, [complete]);
  vi.advanceTimersByTime(1000);
  assert.deepEqual(writes, [complete]);
});

test('lifecycle flush preserves the trailing snapshot and is idempotent', () => {
  const { persistence, writes } = setup();
  const latest = saved('last delta');
  persistence.schedule(latest, true);
  persistence.flush();
  persistence.flush();
  vi.advanceTimersByTime(1000);
  assert.deepEqual(writes, [latest]);
});

test('agent and form changes outside generation save immediately', () => {
  const { persistence, writes } = setup();
  const state = saved('edited');
  persistence.schedule(state, false);
  assert.deepEqual(writes, [state]);
});

test('storage failure reports once and cannot later overwrite existing history', () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  let attempts = 0;
  let errors = 0;
  const persistence = createChatPersistence(
    () => {
      attempts++;
      throw new Error('quota');
    },
    () => errors++,
  );
  persistence.schedule(saved('partial'), true);
  vi.advanceTimersByTime(500);
  persistence.schedule(saved('complete'), false);
  persistence.flush();
  assert.equal(attempts, 1);
  assert.equal(errors, 1);
});
