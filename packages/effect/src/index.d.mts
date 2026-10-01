import type { Effect } from "effect";
export class OperationError extends Error {
  readonly _tag: "OperationError";
  readonly operation: string;
  readonly cause: unknown;
  constructor(operation: string, cause: unknown);
}
export function io<A>(
  operation: string,
  run: (signal: AbortSignal) => PromiseLike<A>,
): Effect.Effect<A, OperationError>;
export function attempt<A>(operation: string, run: () => A): Effect.Effect<A, OperationError>;
