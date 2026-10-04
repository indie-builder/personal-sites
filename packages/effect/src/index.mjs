// @ts-check
import { Data, Effect } from "effect";

/**
 * SDK / platform failures enter the typed error channel at the I/O boundary.
 */
export class OperationError extends Data.TaggedError("OperationError") {
  /** @param {string} operation @param {unknown} cause */
  constructor(operation, cause) {
    super({ operation, cause, message: cause instanceof Error ? cause.message : String(cause) });
  }
}

/**
 * @template A
 * @param {string} operation
 * @param {(signal: AbortSignal) => PromiseLike<A>} run
 * @returns {Effect.Effect<A, OperationError>}
 */
export const io = (operation, run) =>
  Effect.tryPromise({
    try: (signal) => Promise.resolve(run(signal)),
    catch: (cause) => new OperationError(operation, cause),
  });

/**
 * @template A
 * @param {string} operation
 * @param {() => A} run
 * @returns {Effect.Effect<A, OperationError>}
 */
export const attempt = (operation, run) =>
  Effect.try({
    try: run,
    catch: (cause) => new OperationError(operation, cause),
  });
