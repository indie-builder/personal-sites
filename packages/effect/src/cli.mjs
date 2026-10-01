import { Cause, Effect, Exit } from "effect";

/** Node entrypoint: SIGINT/SIGTERM interrupt fibers and await scoped finalizers. */
export async function runCli(program) {
  const controller = new AbortController();
  // Keep the CLI alive while suspended fibers and shutdown finalizers complete.
  const keepAlive = setInterval(() => {}, 2_147_483_647);
  const interrupt = () => {
    process.exitCode = 130;
    controller.abort();
  };
  const terminate = () => {
    process.exitCode = 143;
    controller.abort();
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const exit = await Effect.runPromiseExit(program, { signal: controller.signal });
    if (Exit.isFailure(exit) && !controller.signal.aborted) throw Cause.squash(exit.cause);
    if (Exit.isSuccess(exit)) return exit.value;
  } finally {
    clearInterval(keepAlive);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}
