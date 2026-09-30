import { Cause, Effect, Exit } from "effect";

/** Node entrypoint: SIGINT/SIGTERM interrupt fibers and await scoped finalizers. */
export async function runCli(program) {
  const controller = new AbortController();
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
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}
