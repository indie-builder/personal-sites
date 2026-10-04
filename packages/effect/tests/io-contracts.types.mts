// Compile-only contracts for the public I/O boundary and its inferred value types.
import { Effect } from "effect";
import { attempt, io, OperationError } from "../src/index.mjs";

const asynchronous: Effect.Effect<number, OperationError> = io("contract.promise", async (signal) => {
  const abortSignal: AbortSignal = signal;
  abortSignal.throwIfAborted();
  return 42;
});
declare const thenable: PromiseLike<string>;
const promiseLike: Effect.Effect<string, OperationError> = io("contract.thenable", () => thenable);
const synchronous: Effect.Effect<{ count: number }, OperationError> = attempt("contract.sync", () => ({ count: 1 }));

// @ts-expect-error Promise results retain their inferred number type.
const wrongAsync: Effect.Effect<string, OperationError> = io("contract.number", async () => 42);
// @ts-expect-error Synchronous results retain their inferred object type.
const wrongSync: Effect.Effect<string, OperationError> = attempt("contract.object", () => ({ count: 1 }));
// @ts-expect-error Promise I/O requires a thenable; synchronous work belongs in attempt.
io("contract.invalid", () => 42);
// @ts-expect-error Operation labels must be strings.
attempt(42, () => "ok");

const failure = new OperationError("contract.failure", { status: 503 });
const operation: string = failure.operation;
const cause: unknown = failure.cause;
const tag: "OperationError" = failure._tag;
void [asynchronous, promiseLike, synchronous, wrongAsync, wrongSync, operation, cause, tag];
