import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

import { parseSyncArgs, tweetsFromBirdResponse } from "../scripts/x-curation-sync.mjs";
import { runCommand, runHistoryPipeline, runSyncPipeline, trackXSync } from "../modules/x-sync/pipeline.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";

test("bird source validation accepts empty results and rejects missing arrays or IDs", () => {
  assert.deepEqual(tweetsFromBirdResponse("[]"), []);
  assert.deepEqual(tweetsFromBirdResponse('{"tweets":[{"id":"123"}]}'), [{ id: "123" }]);
  for (const raw of ['{"error":"unauthorized"}', "null", '[{"id":""}]', "[{}]", "invalid"]) {
    assert.throws(() => tweetsFromBirdResponse(raw));
  }
});

test("sync pipeline fetches X data, prepares the sensitive queue, then enriches it", async () => {
  const calls = [];

  await Effect.runPromise(
    runSyncPipeline({
      repoRoot: "/repo",
      options: parseSyncArgs(["--source", "likes", "--limit", "3", "--media"]),
      execute: (command, args, options) => Effect.sync(() => calls.push({ command, args, options })),
    }),
  );

  assert.deepEqual(calls, [
    {
      command: process.execPath,
      args: ["src/cli.js", "fetch", "--source", "likes", "--media"],
      options: {
        cwd: "/repo/tools/smaug",
        env: { BIRD_PATH: "/repo/tools/content/node_modules/.bin/bird" },
        certifyFetch: true,
      },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/x-curation-prepare.mjs", "--source=likes"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/x-curation-enrich.mjs", "--engine", "pi", "--limit", "3"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: [
        "/repo/tools/content/scripts/x-curation-enrich.mjs",
        "--design-only",
        "--engine",
        "pi",
        "--concurrency",
        "15",
        "--limit",
        "3",
      ],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/build-curation-content.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/build-curation-sqlite.mjs"],
      options: { cwd: "/repo" },
    },
  ]);
});

test("both sources retain their own origin before enrichment", async () => {
  const calls = [];

  await Effect.runPromise(
    runSyncPipeline({
      repoRoot: "/repo",
      options: parseSyncArgs(["--fetch-only"]),
      execute: (command, args, options) => Effect.sync(() => calls.push({ command, args, options })),
    }),
  );

  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["src/cli.js", "fetch", "--source", "bookmarks", "--media"],
      ["/repo/tools/content/scripts/x-curation-prepare.mjs", "--source=bookmarks"],
      ["src/cli.js", "fetch", "--source", "likes", "--media"],
      ["/repo/tools/content/scripts/x-curation-prepare.mjs", "--source=likes"],
    ],
  );
});

test("sync pipeline passes the captured X list order to the queue preparation step", async () => {
  const calls = [];

  await Effect.runPromise(
    runSyncPipeline({
      repoRoot: "/repo",
      options: parseSyncArgs(["--source", "bookmarks", "--fetch-only"]),
      captureSourceOrder: (source) => Effect.succeed(`/private/${source}-order.json`),
      execute: (command, args, options) => Effect.sync(() => calls.push({ command, args, options })),
    }),
  );

  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["src/cli.js", "fetch", "--source", "bookmarks", "--media"],
      [
        "/repo/tools/content/scripts/x-curation-prepare.mjs",
        "--source=bookmarks",
        "--source-order-file=/private/bookmarks-order.json",
      ],
    ],
  );
});

test("sync arguments accept the -- separator", () => {
  assert.deepEqual(parseSyncArgs(["--", "--source=bookmarks", "--fetch-only"]), {
    source: "bookmarks",
    limit: null,
    media: true,
    fetchOnly: true,
    history: false,
    engine: "pi",
    codexModel: "gpt-5.6-luna",
    designConcurrency: 15,
    reasoningEffort: "max",
  });
});

test("BigModel Pi is the default and backfills design classification at concurrency 15", async () => {
  const calls = [];
  await Effect.runPromise(
    runSyncPipeline({
      repoRoot: "/repo",
      options: parseSyncArgs(["--source", "bookmarks", "--model", "gpt-5.6-luna", "--reasoning-effort", "max"]),
      execute: (command, args, options) => Effect.sync(() => calls.push({ command, args, options })),
    }),
  );

  assert.deepEqual(calls[2].args, ["/repo/tools/content/scripts/x-curation-enrich.mjs", "--engine", "pi"]);
  assert.deepEqual(calls[3].args, [
    "/repo/tools/content/scripts/x-curation-enrich.mjs",
    "--design-only",
    "--engine",
    "pi",
    "--concurrency",
    "15",
  ]);
});

test("Codex model overrides reach both enrichment stages without duplicate option state", async () => {
  const calls = [];
  const options = parseSyncArgs(["--source", "bookmarks", "--engine", "codex-cli", "--model", "custom-codex-model"]);
  assert.equal(options.codexModel, "custom-codex-model");
  assert.equal(Object.hasOwn(options, "model"), false);

  await Effect.runPromise(runSyncPipeline({
    repoRoot: "/repo",
    options,
    execute: (_command, args) => Effect.sync(() => calls.push(args)),
  }));

  assert.deepEqual(calls[2], [
    "/repo/tools/content/scripts/x-curation-enrich.mjs", "--engine", "codex-cli",
    "--model", "custom-codex-model", "--reasoning-effort", "max",
  ]);
  assert.deepEqual(calls[3], [
    "/repo/tools/content/scripts/x-curation-enrich.mjs", "--design-only", "--engine", "codex-cli",
    "--model", "custom-codex-model", "--reasoning-effort", "high", "--concurrency", "40",
  ]);
});

test("short help sets the same help option as long help", () => {
  assert.equal(parseSyncArgs(["-h"]).help, true);
  assert.deepEqual(parseSyncArgs(["-h"]), parseSyncArgs(["--help"]));
});

test("design backfill concurrency can be overridden without changing full enrichment", () => {
  const options = parseSyncArgs(["--design-concurrency", "12"]);
  assert.equal(options.designConcurrency, 12);
  assert.equal(options.reasoningEffort, "max");
});

test("history pipeline uses bird pagination directly and imports both raw sources", async () => {
  const calls = [];

  await Effect.runPromise(
    runHistoryPipeline({
      repoRoot: "/repo",
      birdPath: "/repo/tools/content/node_modules/.bin/bird",
      credentials: { authToken: "token", ct0: "csrf" },
      execute: (command, args, options) => Effect.sync(() => calls.push({ command, args, options })),
    }),
  );

  assert.deepEqual(calls, [
    {
      command: "/repo/tools/content/node_modules/.bin/bird",
      args: ["bookmarks", "--all", "--json"],
      options: {
        cwd: "/repo",
        env: { AUTH_TOKEN: "token", CT0: "csrf" },
        stdoutPath: "/repo/data/sensitive/x-curation/raw/bookmarks-all.json",
      },
    },
    {
      command: "/repo/tools/content/node_modules/.bin/bird",
      args: ["likes", "--all", "--json"],
      options: {
        cwd: "/repo",
        env: { AUTH_TOKEN: "token", CT0: "csrf" },
        stdoutPath: "/repo/data/sensitive/x-curation/raw/likes-all.json",
      },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/x-curation-import-bird.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/build-curation-content.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/tools/content/scripts/build-curation-sqlite.mjs"],
      options: { cwd: "/repo" },
    },
  ]);
});

for (const [name, run, terminal] of [
  ["zero new items", Effect.succeed({ done: 0, failed: 0 }), "succeeded"],
  ["failed process", Effect.fail(new Error("synthetic private error")), "failed"],
  ["interruption", Effect.interrupt, "failed"],
]) {
  test(`complete sync records ${name} without exposing errors`, async () => {
    const states = [];
    const repoRoot = mkdtempSync(path.join(tmpdir(), "x-sync-state-"));
    try {
      const exit = await Effect.runPromiseExit(trackXSync({
        repoRoot, options: parseSyncArgs([]), run,
        record: (status) => Effect.sync(() => { states.push(status); }),
      }));
      assert.deepEqual(states, ["running", terminal]);
      assert.equal(exit._tag, terminal === "succeeded" ? "Success" : "Failure");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
}

for (const args of [["--fetch-only"], ["--history"], ["--source", "likes"], ["--limit", "3"]]) {
  test(`partial sync ${args.join(" ")} cannot certify the full pipeline`, async () => {
    const states = [];
    const repoRoot = mkdtempSync(path.join(tmpdir(), "x-sync-partial-"));
    try {
      const result = await Effect.runPromise(trackXSync({
        repoRoot, options: parseSyncArgs(args), run: Effect.succeed("done"),
        record: (status) => Effect.sync(() => { states.push(status); }),
      }));
      assert.equal(result, "done");
      assert.deepEqual(states, []);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
}

test("sync exclusion rejects another run before heartbeat or queue mutation and releases on interruption", async () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "x-sync-lock-"));
  const states = [];
  const record = (status) => Effect.sync(() => { states.push(status); });
  try {
    const first = trackXSync({
      repoRoot, options: parseSyncArgs([]), record,
      run: Effect.gen(function* () {
        const second = yield* Effect.exit(trackXSync({
          repoRoot, options: parseSyncArgs(["--fetch-only"]), record,
          run: Effect.sync(() => { states.push("unexpected queue write"); }),
        }));
        assert.equal(second._tag, "Failure");
        return yield* Effect.interrupt;
      }),
    });
    assert.equal((await Effect.runPromiseExit(first))._tag, "Failure");
    assert.deepEqual(states, ["running", "failed"]);
    await Effect.runPromise(trackXSync({ repoRoot, options: parseSyncArgs([]), record, run: Effect.void }));
    assert.deepEqual(states, ["running", "failed", "running", "succeeded"]);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("sync lock excludes another process and recovers automatically after its owner crashes", async () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "x-sync-crash-"));
  const script = `
    import { Effect } from "effect";
    import { trackXSync } from ${JSON.stringify(new URL("../modules/x-sync/pipeline.mjs", import.meta.url).href)};
    await Effect.runPromise(trackXSync({
      repoRoot: process.argv[1], options: { fetchOnly: true },
      run: Effect.sync(() => process.stdout.write("locked\\n")).pipe(Effect.andThen(Effect.never)),
    }));
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script, repoRoot], {
    cwd: path.resolve(import.meta.dirname, ".."), stdio: ["ignore", "pipe", "pipe"],
  });
  let closed;
  try {
    closed = once(child, "close");
    await Promise.race([
      once(child.stdout, "data"),
      closed.then(() => { throw new Error("synthetic lock owner exited before acquiring"); }),
    ]);
    let ran = false;
    const sync = trackXSync({ repoRoot, options: parseSyncArgs(["--fetch-only"]),
      run: Effect.sync(() => { ran = true; }) });
    assert.equal((await Effect.runPromiseExit(sync))._tag, "Failure");
    assert.equal(ran, false);
    child.kill("SIGKILL");
    await closed;
    await Effect.runPromise(sync);
    assert.equal(ran, true);
  } finally {
    child.kill("SIGKILL");
    if (closed) await closed;
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

for (const [name, stdout, stderr, succeeds] of [
  ["zero new items", "No new tweets to process.\n", "", true],
  ["prepared all", "Preparing 2 tweets...\n✓ Prepared 2 tweets.\n", "", true],
  ["swallowed item failure", "Preparing 2 tweets...\n✓ Prepared 1 tweets.\n", "Error processing bookmark 123: private details\n", false],
  ["swallowed folder failure", "No new tweets to process.\n", "Error fetching folder 456: private details\n", false],
  ["missing prepared item", "Preparing 2 tweets...\n✓ Prepared 1 tweets.\n", "", false],
  ["unknown outcome", "changed upstream output\n", "", false],
]) {
  test(`fetch adapter validates ${name} without relying on exit code zero`, async () => {
    const script = `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)});`;
    const exit = await Effect.runPromiseExit(runCommand(process.execPath, ["-e", script], {
      cwd: process.cwd(), certifyFetch: true,
    }));
    assert.equal(exit._tag, succeeds ? "Success" : "Failure");
    if (!succeeds) assert.equal(String(exit.cause).includes("private details"), false);
  });
}

test("Pi analysis uses BigModel and permits GLM model overrides", () => {
  const resolved = resolvePiModelConfig({
    env: { BIGMODEL_MODEL: "glm-5.3", PI_MODEL_PROVIDER: "another-provider" },
  });

  assert.deepEqual(resolved, {
    provider: "bigmodel-coding",
    model: "glm-5.3",
  });
});
