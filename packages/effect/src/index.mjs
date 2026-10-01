import { Data, Effect } from "effect";

/** SDK / platform failures enter the typed error channel at the I/O boundary. */
export class OperationError extends Data.TaggedError("OperationError") {
  constructor(operation, cause) {
    super({ operation, cause, message: cause instanceof Error ? cause.message : String(cause) });
  }
}

export const io = (operation, run) =>
  Effect.tryPromise({
    try: (signal) => Promise.resolve(run(signal)),
    catch: (cause) => new OperationError(operation, cause),
  });

export const attempt = (operation, run) =>
  Effect.try({
    try: run,
    catch: (cause) => new OperationError(operation, cause),
  });
