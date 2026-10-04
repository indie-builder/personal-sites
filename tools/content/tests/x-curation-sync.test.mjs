import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";

import { parseSyncArgs } from "../scripts/x-curation-sync.mjs";
import { runHistoryPipeline, runSyncPipeline } from "../modules/x-sync/pipeline.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";

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

test("sync arguments accept pnpm's -- separator", () => {
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

test("Pi analysis uses BigModel and permits GLM model overrides", () => {
  const resolved = resolvePiModelConfig({
    env: { BIGMODEL_MODEL: "glm-5.3", PI_MODEL_PROVIDER: "another-provider" },
  });

  assert.deepEqual(resolved, {
    provider: "bigmodel-coding",
    model: "glm-5.3",
  });
});
