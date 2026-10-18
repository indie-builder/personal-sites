import { spawn } from "node:child_process";
import { Deferred, Effect } from "effect";
import { attempt, io, OperationError } from "@site/effect";
import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import path from "node:path";

function killOwnedGroup(child) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export function acquireSubprocess(command, args, options, operation) {
  const workers = (options.env ?? process.env).X_SYNC_WORKER_DIRECTORY;
  return Effect.acquireRelease(
    attempt(operation, () => {
      if (process.platform === "win32") throw new Error("内容 CLI 的进程组清理需要 Unix 平台。");
      // X workers cannot execute until their group marker survives a parent crash.
      const gate = 'IFS= read -r start <&3 && [ "$start" = start ] || exit 1; exec 3<&-; exec "$@"';
      const child = workers
        ? spawn("/bin/sh", ["-c", gate, "x-sync-worker", command, ...args], {
          ...options, detached: true, stdio: [...options.stdio, "pipe"],
        })
        : spawn(command, args, { ...options, detached: true });
      let groupTerminated = false;
      const terminateGroup = () => {
        if (groupTerminated) return;
        killOwnedGroup(child);
        groupTerminated = true;
      };
      const closed = Deferred.makeUnsafe();
      const settled = Deferred.makeUnsafe();
      child.once("error", (error) => {
        const failure = Effect.fail(new OperationError(operation, error));
        Deferred.doneUnsafe(closed, failure);
      });
      child.once("exit", () => {
        // Descendants can hold the leader's pipes open, so terminate its group before waiting for close.
        try {
          terminateGroup();
        } catch (error) {
          Deferred.doneUnsafe(closed, Effect.fail(new OperationError("process.terminate", error)));
        }
      });
      child.once("close", (code, signal) => {
        Deferred.doneUnsafe(closed, Effect.succeed({ code, signal }));
        Deferred.doneUnsafe(settled, Effect.void);
      });
      return { child, closed, settled, terminateGroup };
    }),
    ({ settled, terminateGroup }) => Effect.gen(function* () {
      yield* attempt("process.terminate", terminateGroup).pipe(Effect.orDie);
      yield* Deferred.await(settled);
    }),
  ).pipe(Effect.tap(({ child }) => workers ? Effect.gen(function* () {
    yield* attempt("x.sync-worker.register", () => {
      const marker = path.join(workers, `${randomUUID()}.json`);
      writeFileSync(`${marker}.tmp`, JSON.stringify(child.pid), { mode: 0o600 });
      renameSync(`${marker}.tmp`, marker);
    });
    yield* io("x.sync-worker.start", () => new Promise((resolve, reject) => {
      child.stdio[3].once("error", reject);
      child.stdio[3].end("start\n", (error) => error ? reject(error) : resolve());
    }));
  }) : Effect.void));
}
