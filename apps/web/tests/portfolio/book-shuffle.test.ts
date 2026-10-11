// @vitest-environment node
import assert from 'node:assert/strict';
import { test } from "vitest";
import { shuffleBooks } from "../../lib/portfolio/book-shuffle";

test('every round visits all books once and avoids repeating the boundary book', () => {
  let previous = -1;
  for (let round = 0; round < 100; round++) {
    const order = shuffleBooks(8, previous);
    assert.equal(order.length, 8);
    assert.deepEqual([...order].sort((a,b)=>a-b), [0,1,2,3,4,5,6,7]);
    assert.notEqual(order[0], previous);
    previous = order.at(-1) ?? -1;
  }
});
test('empty and single-book collections terminate', () => {
  assert.deepEqual(shuffleBooks(0), []);
  assert.deepEqual(shuffleBooks(1, 0), [0]);
});
