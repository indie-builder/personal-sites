import assert from "node:assert/strict";
import test from "node:test";
import { Effect, Exit, Schema } from "effect";
import { attempt, io, OperationError } from "../src/index.mjs";
import { DateTimeString, UrlString, UtcDateTimeString } from "../src/schema.mjs";

test("I/O is lazy and retains the original cause in the typed failure channel", async () => {
  let calls = 0;
  const cause = new Error("offline");
  const request = io("test.request", async () => {
    calls += 1;
    throw cause;
  });
  assert.equal(calls, 0);
  const error = await Effect.runPromise(Effect.flip(request));
  assert.equal(calls, 1);
  assert.ok(error instanceof OperationError);
  assert.equal(error.cause, cause);
  assert.equal(error.operation, "test.request");
  assert.equal(error.message, "offline");
  assert.equal(
    (
      await Effect.runPromise(
        Effect.flip(
          attempt("test.sync", () => {
            throw cause;
          }),
        ),
      )
    ).cause,
    cause,
  );
});

test("timeout aborts I/O and runs scoped cleanup exactly once", async () => {
  let signal;
  let released = 0;
  const program = Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(Effect.succeed(null), () =>
        Effect.sync(() => {
          released += 1;
        }),
      );
      yield* io("test.wait", (currentSignal) => {
        signal = currentSignal;
        return new Promise(() => {});
      });
    }),
  ).pipe(Effect.timeout("20 millis"));
  const exit = await Effect.runPromiseExit(program);
  assert.ok(Exit.isFailure(exit));
  assert.equal(signal.aborted, true);
  assert.equal(released, 1);
});

test("public URL and timestamp constraints survive the schema migration", () => {
  assert.equal(Schema.decodeUnknownSync(UrlString)("https://example.com/a"), "https://example.com/a");
  assert.throws(() => Schema.decodeUnknownSync(UrlString)("not-a-url"));
  assert.equal(Schema.decodeUnknownSync(DateTimeString)("2026-09-30T12:00:00+08:00"), "2026-09-30T12:00:00+08:00");
  for (const value of ["2026-02-30T12:00:00Z", "2026-09-30", "2026-09-30T25:00:00Z", "2026-09-30T12:00:00+08:00"]) {
    assert.throws(() => Schema.decodeUnknownSync(UtcDateTimeString)(value));
  }
});

test("CLI SIGTERM interrupts work and waits for cleanup", async () => {
  const { spawn } = await import("node:child_process");
  const script = `
    import { Effect } from "effect";
    import { runCli } from "./src/cli.mjs";
    await runCli(Effect.scoped(Effect.gen(function* () {
      yield* Effect.acquireRelease(Effect.sync(() => console.log("ready")),
        () => Effect.sleep("10 millis").pipe(Effect.tap(() => Effect.sync(() => console.log("released")))));
      yield* Effect.never;
    })));
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("../", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  const completed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  let terminated = false;
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (!terminated && output.includes("ready")) {
      terminated = true;
      child.kill("SIGTERM");
    }
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    const result = await completed;
    assert.equal(result.code, 143, errors);
    assert.equal(result.signal, null);
    assert.match(output, /released/u);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});
