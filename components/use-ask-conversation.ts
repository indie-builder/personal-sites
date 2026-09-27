"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { readAskChatSnapshot, writeAskChatSnapshot, type ChatMessage } from "@/components/ask-chat-snapshot";
import { applyStreamEvent, parseEvents } from "@/components/ask-sse";
import { useVisitorSession } from "@/components/use-visitor-session";

export function useAskConversation(textareaRef: RefObject<HTMLTextAreaElement | null>, onStarted: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [restored, setRestored] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  // 会话预热期间尚未置位 isStreaming；同步标记阻止双击或回车重入。
  const submitInFlight = useRef(false);
  const snapshotRead = useRef(false);
  const { ensureVisitorSession, isRetryingSession, retryVisitorSession, visitorId } = useVisitorSession(textareaRef);

  useLayoutEffect(() => {
    // Lazy Markdown 可重新连接 layout effect；一次实例只恢复一次快照。
    if (snapshotRead.current) return;
    snapshotRead.current = true;
    const snapshot = readAskChatSnapshot();
    if (snapshot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 水合后、绘制前恢复会话，避免草稿闪烁。
      setMessages(snapshot.messages);
      setQuestion(snapshot.question);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) writeAskChatSnapshot({ messages, question });
  }, [messages, question, restored]);

  useEffect(() => () => requestController.current?.abort(), []);

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  };

  const submit = async (suggestion?: string, { preserveDraft = false }: { preserveDraft?: boolean } = {}) => {
    const trimmedQuestion = (suggestion ?? question).trim();
    if (!trimmedQuestion || isStreaming || visitorId === "unavailable" || submitInFlight.current) return;
    submitInFlight.current = true;

    const session = await ensureVisitorSession();
    if (session.visitorId === "unavailable") {
      submitInFlight.current = false;
      return;
    }

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    onStarted();
    // 失败重试的问题来自历史消息，保留输入框里正在编辑的草稿。
    if (!preserveDraft) setQuestion("");
    setIsStreaming(true);
    const controller = new AbortController();
    requestController.current = controller;
    setMessages((current) => [...current,
      { citations: [], content: trimmedQuestion, id: userId, isComplete: true, role: "user" },
      { citations: [], content: "", id: assistantId, isComplete: false, role: "assistant" },
    ]);

    try {
      const response = await fetch("/api/ask", {
        body: JSON.stringify({ conversationId: session.conversationId, question: trimmedQuestion, scope: "all", visitorId: session.visitorId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof payload?.error === "string" ? payload.error : "回答暂时不可用，请稍后重试。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parsed = parseEvents(buffer);
        buffer = parsed.remainder;
        for (const item of parsed.events) {
          updateAssistant(assistantId, (message) => applyStreamEvent(message, item));
        }
        if (done) break;
      }
      updateAssistant(assistantId, (message) => ({ ...message, isComplete: true }));
    } catch (error) {
      const stopped = controller.signal.aborted;
      const message = stopped
        ? "已停止生成。"
        : error instanceof Error ? error.message : "回答暂时不可用，请稍后重试。";
      updateAssistant(assistantId, (current) => ({
        ...current,
        interruption: { kind: stopped ? "stopped" : "error", message },
        isComplete: true,
      }));
    } finally {
      submitInFlight.current = false;
      requestController.current = null;
      setIsStreaming(false);
    }
  };

  return {
    ensureVisitorSession, isRetryingSession, isStreaming, messages, question, retryVisitorSession,
    setQuestion, stop: () => requestController.current?.abort(), submit, visitorId,
  };
}
