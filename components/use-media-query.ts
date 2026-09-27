"use client";

import { useCallback, useSyncExternalStore } from "react";

const serverSnapshot = () => false;

export function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const snapshot = useCallback(() => matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
