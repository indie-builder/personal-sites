"use client";

import { useSyncExternalStore } from "react";

/** useSyncExternalStore 的占位订阅：不订阅任何来源，仅用于区分 SSR 与客户端渲染。 */
export const subscribeToNothing = () => () => {};

/** 水合前为 false、水合后为 true；用于只能在客户端渲染的分支，避免 SSR 不一致。 */
export function useHasMounted() {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}
