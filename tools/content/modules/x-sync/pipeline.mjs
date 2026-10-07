import { Deferred, Effect } from "effect";
import { attempt } from "@site/effect";
import { acquireSubprocess } from "../../lib/subprocess.mjs";
import { closeSync, openSync } from "node:fs";
import path from "node:path";

export function runCommand(command, args, options) {
  return Effect.scoped(
    Effect.gen(function* () {
      const output = yield* Effect.acquireRelease(
        attempt("pipeline.output", () => (options.stdoutPath ? openSync(options.stdoutPath, "w", 0o600) : null)),
        (descriptor) =>
          Effect.sync(() => {
            if (descriptor !== null) closeSync(descriptor);
          }),
      );
      const { closed } = yield* acquireSubprocess(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ["inherit", output ?? "inherit", "inherit"],
      }, "pipeline.process");
      const { code, signal } = yield* Deferred.await(closed);
      if (code !== 0) return yield* Effect.fail(new Error(
        `${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`,
      ));
    }),
  );
}

export function runSyncPipeline({ repoRoot, options, captureSourceOrder, env = process.env, execute = runCommand }) {
  return Effect.gen(function* () {
    const smaugRoot = path.join(repoRoot, "tools/smaug");
    const birdPath = env.BIRD_PATH ?? path.join(repoRoot, "tools/content/node_modules/.bin/bird");
    const sources = options.source === "both" ? ["bookmarks", "likes"] : [options.source];

    for (const source of sources) {
      const sourceOrderPath = captureSourceOrder ? yield* captureSourceOrder(source) : null;
      const fetchArgs = ["src/cli.js", "fetch", "--source", source];
      if (options.media) fetchArgs.push("--media");
      yield* execute(process.execPath, fetchArgs, { cwd: smaugRoot, env: { BIRD_PATH: birdPath } });
      const prepareArgs = [path.join(repoRoot, "tools/content/scripts/x-curation-prepare.mjs"), `--source=${source}`];
      if (sourceOrderPath) prepareArgs.push(`--source-order-file=${sourceOrderPath}`);
      yield* execute(process.execPath, prepareArgs, { cwd: repoRoot });
    }
    if (options.fetchOnly) return;

    const enrichArgs = [path.join(repoRoot, "tools/content/scripts/x-curation-enrich.mjs"), "--engine", options.engine];
    if (options.engine === "codex-cli") {
      enrichArgs.push("--model", options.codexModel, "--reasoning-effort", options.reasoningEffort);
    }
    if (options.limit !== null) enrichArgs.push("--limit", String(options.limit));
    yield* execute(process.execPath, enrichArgs, { cwd: repoRoot });

    // 新条目在正文解析时已经完成设计分类；第二阶段只补历史上“已有解析但缺分类”的条目，
    // 不重写标题、摘要或深度解析。Codex 正文保持单并发，轻量分类使用已验证的并发档。
    const designArgs = [
      path.join(repoRoot, "tools/content/scripts/x-curation-enrich.mjs"),
      "--design-only",
      "--engine",
      options.engine,
    ];
    if (options.engine === "codex-cli") {
      designArgs.push("--model", options.codexModel, "--reasoning-effort", "high");
    }
    designArgs.push("--concurrency", String(options.designConcurrency));
    if (options.limit !== null) designArgs.push("--limit", String(options.limit));
    yield* execute(process.execPath, designArgs, { cwd: repoRoot });
    yield* execute(process.execPath, [path.join(repoRoot, "tools/content/scripts/build-curation-content.mjs")], {
      cwd: repoRoot,
    });
    yield* execute(process.execPath, [path.join(repoRoot, "tools/content/scripts/build-curation-sqlite.mjs")], {
      cwd: repoRoot,
    });
  });
}

export function runHistoryPipeline({ repoRoot, birdPath, credentials, execute = runCommand }) {
  return Effect.gen(function* () {
    const rawDir = path.join(repoRoot, "data/sensitive/x-curation/raw");
    const env = { AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 };
    const sources = [
      { command: "bookmarks", output: "bookmarks-all.json" },
      { command: "likes", output: "likes-all.json" },
    ];
    for (const source of sources) {
      yield* execute(birdPath, [source.command, "--all", "--json"], {
        cwd: repoRoot,
        env,
        stdoutPath: path.join(rawDir, source.output),
      });
    }
    yield* execute(process.execPath, [path.join(repoRoot, "tools/content/scripts/x-curation-import-bird.mjs")], {
      cwd: repoRoot,
    });
    yield* execute(process.execPath, [path.join(repoRoot, "tools/content/scripts/build-curation-content.mjs")], {
      cwd: repoRoot,
    });
    yield* execute(process.execPath, [path.join(repoRoot, "tools/content/scripts/build-curation-sqlite.mjs")], {
      cwd: repoRoot,
    });
  });
}
