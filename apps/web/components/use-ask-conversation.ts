"use client";

import { Effect } from "effect";
import { io } from "@site/effect";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { readAskChatSnapshot, writeAskChatSnapshot, type ChatMessage } from "@/components/ask-chat-snapshot";
import { applyStreamEvent, parseEvents } from "@/components/ask-sse";
import { askIdPattern } from "@/lib/ask-types";

function readOrCreateId(storageName: "localStorage" | "sessionStorage", key: string) {
  const id = crypto.randomUUID();
  try {
    const storage = window[storageName];
    const stored = storage.getItem(key);
    if (stored && askIdPattern.test(stored)) return stored;
    storage.setItem(key, id);
  } catch {} // 存储被禁用时，当前抽屉仍使用内存中的随机标识。
  return id;
}

export function useAskConversation(onStarted: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [restored, setRestored] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  // React 提交状态更新前，同步标记阻止双击或回车重入。
  const submitInFlight = useRef(false);
  const snapshotRead = useRef(false);
  const session = useRef<{ conversationId: string; visitorId: string } | null>(null);

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
    setMessages((current) => current.map((message) => (message.id === id ? update(message) : message)));
  };

  const submit = async (suggestion?: string, { preserveDraft = false }: { preserveDraft?: boolean } = {}) => {
    const trimmedQuestion = (suggestion ?? question).trim();
    if (!trimmedQuestion || isStreaming || submitInFlight.current) return;
    submitInFlight.current = true;

    session.current ??= {
      conversationId: readOrCreateId("sessionStorage", "personal-site:ask-conversation-id"),
      visitorId: readOrCreateId("localStorage", "personal-site:ask-visitor-id"),
    };
    const identity = session.current;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    onStarted();
    // 失败重试的问题来自历史消息，保留输入框里正在编辑的草稿。
    if (!preserveDraft) setQuestion("");
    setIsStreaming(true);
    const controller = new AbortController();
    requestController.current = controller;
    setMessages((current) => [
      ...current,
      { citations: [], content: trimmedQuestion, id: userId, isComplete: true, role: "user" },
      { citations: [], content: "", id: assistantId, isComplete: false, role: "assistant" },
    ]);

    try {
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const response = yield* io("ask.request", (signal) =>
              fetch("/api/ask", {
                body: JSON.stringify({
                  conversationId: identity.conversationId,
                  format: "openui",
                  question: trimmedQuestion,
                  scope: "all",
                  visitorId: identity.visitorId,
                }),
                headers: { "Content-Type": "application/json" },
                method: "POST",
                signal: AbortSignal.any([signal, controller.signal]),
              }),
            );
            if (!response.ok || !response.body) {
              const payload = yield* io(
                "ask.error",
                () => response.json().catch(() => null) as Promise<{ error?: unknown } | null>,
              );
              return yield* Effect.fail(
                new Error(typeof payload?.error === "string" ? payload.error : "回答暂时不可用，请稍后重试。"),
              );
            }

            const reader = yield* Effect.acquireRelease(
              Effect.sync(() => response.body!.getReader()),
              (reader) =>
                io("ask.cancel", () => reader.cancel()).pipe(
                  Effect.catch(() => Effect.void),
                  Effect.ensuring(Effect.sync(() => reader.releaseLock())),
                ),
            );
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = yield* io("ask.read", () => reader.read());
              buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
              const parsed = parseEvents(buffer);
              buffer = parsed.remainder;
              for (const item of parsed.events) {
                updateAssistant(assistantId, (message) => applyStreamEvent(message, item));
              }
              if (done) break;
            }
            updateAssistant(assistantId, (message) => ({ ...message, isComplete: true }));
          }),
        ),
        { signal: controller.signal },
      );
    } catch (error) {
      const stopped = controller.signal.aborted;
      const message = stopped
        ? "已停止生成。"
        : error instanceof Error
          ? error.message
          : "回答暂时不可用，请稍后重试。";
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
    isStreaming,
    messages,
    question,
    setQuestion,
    stop: () => requestController.current?.abort(),
    submit,
  };
}
