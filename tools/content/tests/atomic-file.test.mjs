import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { writeJsonAtomically, writeTextAtomically } from "../scripts/lib/atomic-file.mjs";

test("queue JSON is replaced atomically without leaving temporary files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "x-curation-queue-"));
  const queuePath = path.join(directory, "queue.json");
  try {
    await Effect.runPromise(writeJsonAtomically(queuePath, { items: [{ id: "1" }], version: 3 }));
    await Effect.runPromise(writeJsonAtomically(queuePath, { items: [{ id: "2" }], version: 3 }));

    assert.deepEqual(JSON.parse(await readFile(queuePath, "utf8")), {
      items: [{ id: "2" }],
      version: 3,
    });
    assert.deepEqual(await readdir(directory), ["queue.json"]);
    const privatePath = path.join(directory, "private", "queue.json");
    await Effect.runPromise(writeTextAtomically(privatePath, '{"items":[]}\n'));
    assert.equal(await readFile(privatePath, "utf8"), '{"items":[]}\n');
    assert.equal((await stat(path.dirname(privatePath))).mode & 0o777, 0o700);
    assert.equal((await stat(privatePath)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(path.dirname(privatePath)), ["queue.json"]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
