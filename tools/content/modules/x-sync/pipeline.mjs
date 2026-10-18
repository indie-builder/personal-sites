import { Context, Deferred, Effect, Exit, Schema } from "effect";
import { attempt } from "@site/effect";
import Database from "better-sqlite3";
import { initializePublicDatabase, PUBLIC_DATABASE_PATH } from "@site/public-data/sqlite.mjs";
import { recordXSyncState } from "@site/public-data/data-health/sqlite.mjs";
import { acquireSubprocess } from "../../lib/subprocess.mjs";
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const WorkerOwners = Context.Reference("x-sync/WorkerOwners", { defaultValue: () => null });
const decodeWorkerGroup = Schema.decodeUnknownSync(Schema.Int.check(Schema.isGreaterThan(0)));

function groupIsAlive(group) {
  try {
    process.kill(-group, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

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
      // shortcut: Smaug has no structured failure report; fail closed if its completion protocol changes.
      let transcript = "";
      let overflow = false;
      const owners = yield* WorkerOwners;
      const { child, closed } = yield* acquireSubprocess(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env, ...(owners ? { X_SYNC_WORKER_DIRECTORY: owners } : {}) },
        stdio: ["inherit", options.certifyFetch ? "pipe" : output ?? "inherit", options.certifyFetch ? "pipe" : "inherit"],
      }, "pipeline.process");
      if (options.certifyFetch) {
        const collect = (chunk) => {
          if (transcript.length + chunk.length <= 10 * 1024 * 1024) transcript += chunk;
          else overflow = true;
        };
        child.stdout.setEncoding("utf8").on("data", collect);
        child.stderr.setEncoding("utf8").on("data", collect);
      }
      const { code, signal } = yield* Deferred.await(closed);
      if (code !== 0) return yield* Effect.fail(new Error(
        `${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`,
      ));
      if (options.certifyFetch) {
        const expected = transcript.match(/^Preparing (\d+) tweets\.\.\.$/mu)?.[1];
        const prepared = transcript.match(/^✓ Prepared (\d+) tweets\.$/mu)?.[1];
        const complete = prepared !== undefined && expected === prepared
          || expected === undefined && /^No new tweets to process\.$/mu.test(transcript);
        if (overflow || !complete || /^\s*Error (?:processing bookmark|fetching folder) /mu.test(transcript)) {
          return yield* Effect.fail(new Error("X 抓取未完整完成；不更新成功记录，请检查本机抓取器。"));
        }
      }
    }),
  );
}

export function trackXSync({ repoRoot, options, run, record = (status, runId) => attempt("x.sync-state", () => {
  const database = new Database(path.join(repoRoot, PUBLIC_DATABASE_PATH), { fileMustExist: true });
  try {
    initializePublicDatabase(database);
    if (!recordXSyncState(database, status, new Date().toISOString(), runId)) {
      throw new Error("X 同步运行已失去状态所有权。");
    }
  } finally {
    database.close();
  }
}) }) {
  return Effect.scoped(Effect.gen(function* () {
    const owners = yield* Effect.acquireRelease(
      attempt("x.sync-lock", () => {
        const directory = path.join(repoRoot, "var");
        mkdirSync(directory, { recursive: true });
        const database = new Database(path.join(directory, "x-sync-lock.sqlite"), { timeout: 0 });
        try {
          database.exec("BEGIN EXCLUSIVE");
          const workers = path.join(directory, "x-sync-workers");
          mkdirSync(workers, { recursive: true });
          for (const filename of readdirSync(workers).filter((name) => name.endsWith(".json"))) {
            const marker = path.join(workers, filename);
            const group = decodeWorkerGroup(JSON.parse(readFileSync(marker, "utf8")));
            if (groupIsAlive(group)) throw new Error("surviving X sync worker");
            rmSync(marker);
          }
          return { database, workers };
        } catch {
          database.close();
          throw new Error("已有 X 同步或遗留工作进程正在运行；本次未开始。");
        }
      }),
      ({ database }) => Effect.sync(() => database.close()),
    );
    const tracked = run.pipe(Effect.provideService(WorkerOwners, owners.workers));
    if (options.fetchOnly || options.history || options.source !== "both" || options.limit !== null) return yield* tracked;
    const runId = randomUUID();
    return yield* Effect.acquireUseRelease(
      record("running", runId),
      () => tracked,
      (_, exit) => record(Exit.isSuccess(exit) ? "succeeded" : "failed", runId),
    );
  }));
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
      yield* execute(process.execPath, fetchArgs, { cwd: smaugRoot, env: { BIRD_PATH: birdPath }, certifyFetch: true });
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
