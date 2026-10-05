import { Effect } from "effect";
import "server-only";

import { cache } from "react";

/**
 * 每请求记忆化：Effect.cached 只在 React cache 回调内分配，同请求内重复读取共享结果，
 * 跨请求/访客不共享请求绑定的 fiber。
 */
export function cachedRequest<Args extends unknown[], A, E>(
  program: (...args: Args) => Effect.Effect<A, E>,
) {
  return cache((...args: Args) => Effect.runSync(Effect.cached(program(...args))));
}
