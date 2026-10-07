import { spawn } from "node:child_process";
import { Deferred, Effect } from "effect";
import { attempt, OperationError } from "@site/effect";

function killOwnedGroup(child) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export function acquireSubprocess(command, args, options, operation) {
  return Effect.acquireRelease(
    attempt(operation, () => {
      if (process.platform === "win32") throw new Error("内容 CLI 的进程组清理需要 Unix 平台。");
      const child = spawn(command, args, { ...options, detached: true });
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
  );
}
