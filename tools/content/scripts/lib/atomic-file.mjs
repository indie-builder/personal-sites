import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { io } from "@site/effect";

export function writeTextAtomically(filePath, text, { mode = 0o600 } = {}) {
  return Effect.uninterruptible(
    Effect.scoped(
      Effect.gen(function* () {
        yield* io("file.directory", () => mkdir(path.dirname(filePath), { mode: 0o700, recursive: true }));
        const temporaryPath = yield* Effect.acquireRelease(
          Effect.sync(() => `${filePath}.${process.pid}.${randomUUID()}.tmp`),
          (temporaryPath) => io("file.cleanup", () => rm(temporaryPath, { force: true })).pipe(Effect.orDie),
        );
        yield* io("file.write", () => writeFile(temporaryPath, text, { mode }));
        yield* io("file.rename", () => rename(temporaryPath, filePath));
      }),
    ),
  );
}

export function writeJsonAtomically(filePath, value, options) {
  return Effect.suspend(() => writeTextAtomically(filePath, JSON.stringify(value, null, 2) + "\n", options));
}
