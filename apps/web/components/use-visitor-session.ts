"use client";

import { useLayoutEffect, useCallback, useRef, useState, type RefObject } from "react";

/**
 * 访客指纹用于匿名会话；限流由服务端按 IP 执行。聚焦或提交后才计算指纹。
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
        const key = "personal-site:ask-conversation-id";
        let conversationId = crypto.randomUUID();
        try {
          const stored = window.sessionStorage.getItem(key);
          if (stored && /^[A-Za-z0-9_-]{16,128}$/.test(stored)) conversationId = stored;
          else window.sessionStorage.setItem(key, conversationId);
        } catch {} // 禁用 sessionStorage 时仍允许当前页面提问。
        const session = { conversationId, visitorId: result.visitorId };
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
