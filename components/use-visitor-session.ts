"use client";

import { useLayoutEffect, useCallback, useRef, useState, type RefObject } from "react";

/**
 * 访客会话：指纹只用于限流，等用户表现出提问意图（聚焦输入框或提交）后再加载计算。
 * 会话建立失败时给出可重试状态；重试成功后把焦点交还输入框。
 */
export function useVisitorSession(focusTargetRef: RefObject<HTMLTextAreaElement | null>) {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isRetryingSession, setIsRetryingSession] = useState(false);
  const sessionPromise = useRef<Promise<{ conversationId: string; visitorId: string }> | null>(null);
  const shouldFocusAfterSessionRetry = useRef(false);

  const ensureVisitorSession = useCallback(() => {
    sessionPromise.current ??= (async () => {
      try {
        const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const result = await agent.get();
        const session = { conversationId: crypto.randomUUID(), visitorId: result.visitorId };
        setVisitorId(session.visitorId);
        return session;
      } catch {
        setVisitorId("unavailable");
        return { conversationId: "", visitorId: "unavailable" };
      }
    })();
    return sessionPromise.current;
  }, []);

  const retryVisitorSession = useCallback(async () => {
    if (isRetryingSession) return;
    setIsRetryingSession(true);
    shouldFocusAfterSessionRetry.current = true;
    sessionPromise.current = null;
    const session = await ensureVisitorSession();
    setIsRetryingSession(false);
    if (session.visitorId === "unavailable") shouldFocusAfterSessionRetry.current = false;
  }, [ensureVisitorSession, isRetryingSession]);

  useLayoutEffect(() => {
    if (!visitorId || visitorId === "unavailable" || !shouldFocusAfterSessionRetry.current) return;
    shouldFocusAfterSessionRetry.current = false;
    focusTargetRef.current?.focus();
  }, [focusTargetRef, visitorId]);

  return { ensureVisitorSession, isRetryingSession, retryVisitorSession, visitorId };
}
