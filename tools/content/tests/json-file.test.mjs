import { Effect } from "effect";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readJsonOr } from "../scripts/lib/json-file.mjs";

test("JSON reader defaults only missing files", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "personal-sites-json-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  assert.deepEqual(await Effect.runPromise(readJsonOr(path.join(directory, "missing.json"), { items: [] })), {
    items: [],
  });
  const malformed = path.join(directory, "malformed.json");
  await writeFile(malformed, "{invalid");
  const failure = await Effect.runPromise(Effect.flip(readJsonOr(malformed, {})));
  assert.ok(failure.cause instanceof SyntaxError);
});
