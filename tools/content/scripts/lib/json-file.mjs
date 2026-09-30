import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";

/** Missing files use the fallback; permission errors and invalid JSON still fail. */
export function readJsonOr(filePath, fallback) {
  return io("file.read", () => readFile(filePath, "utf8")).pipe(
    Effect.flatMap((text) => attempt("file.json", () => JSON.parse(text))),
    Effect.catchAll((error) => (error.cause?.code === "ENOENT" ? Effect.succeed(fallback) : Effect.fail(error))),
  );
}
