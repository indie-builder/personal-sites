import assert from "node:assert/strict";
import { Effect } from "effect";
import { runCli } from "@site/effect/cli";
import test from "node:test";
import { parseCliOptions } from "../scripts/lib/cli.mjs";
import { registerCliMocks } from "./helpers/cli-mock.mjs";

test("AI news CLI defers work and lets SIGTERM finish sync finalizers", async () => {
  const cliUrl = new URL("../scripts/ai-news-sync.mjs", import.meta.url);
  const key = "aiNewsCliCancellation";
  let envLoads = 0;
  let syncCalls = 0;
  let finalized = false;
  const state = {
    loadLocalEnv: () => { envLoads += 1; },
    syncAiNews: ({ backfill }) => Effect.gen(function* () {
      syncCalls += 1;
      assert.equal(backfill, true);
      yield* Effect.sync(() => setImmediate(() => process.emit("SIGTERM")));
      yield* Effect.never;
    }).pipe(Effect.ensuring(Effect.sync(() => { finalized = true; }))),
  };
  const adapters = new Map([
    ["@site/public-data/ai-news/sync.mjs", ["syncAiNews"]],
    ["../../../scripts/lib/load-local-env.mjs", ["loadLocalEnv"]],
  ]);
  const originalExitCode = process.exitCode;
  globalThis[key] = state;
  const hooks = registerCliMocks({
    key,
    scheme: "ai-news-test",
    matches: (parentURL) => parentURL === cliUrl.href,
    mockExports: adapters,
  });
  try {
    const { main } = await import(cliUrl.href);
    const program = main(["--backfill"]);
    assert.equal(envLoads, 0);
    assert.equal(syncCalls, 0);
    await runCli(program);
    assert.equal(envLoads, 1);
    assert.equal(syncCalls, 1);
    assert.equal(finalized, true);
    assert.equal(process.exitCode, 143);
  } finally {
    hooks.deregister();
    process.exitCode = originalExitCode;
    delete globalThis[key];
  }
});

for (const inline of [false, true]) {
  const argsFor = (value) => inline ? [`--limit=${value}`] : ["--limit", value];
  const syntax = inline ? "--limit=value" : "--limit value";

  test(`integer options accept safe positive decimal values with ${syntax}`, () => {
    for (const value of ["1", String(Number.MAX_SAFE_INTEGER)]) {
      assert.equal(parseCliOptions(argsFor(value), { "--limit": "int" }).limit, Number(value));
    }
  });

  test(`integer options reject malformed and unsafe values with ${syntax}`, () => {
    for (const value of ["2.5", "2junk", "1e3", "9007199254740993", "9007199254740992", "0", "-1", "", "+1", " 1", "1 "]) {
      assert.throws(
        () => parseCliOptions(argsFor(value), { "--limit": "int" }),
        { message: "--limit 必须是大于 0 的整数。" },
        `value: ${JSON.stringify(value)}`,
      );
    }
  });
}
