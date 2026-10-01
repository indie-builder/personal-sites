import type { Effect } from "effect";
export function runCli<A, E>(program: Effect.Effect<A, E>): Promise<A | undefined>;
