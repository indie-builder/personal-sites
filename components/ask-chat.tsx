"use client";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent } from "@/components/ui/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { SpriteWalker } from "@/components/assistant-sprite";
import { readAskChatSnapshot, writeAskChatSnapshot, type ChatMessage } from "@/components/ask-chat-snapshot";
import { AskMessageItem, EMPTY_ENTER_DURATION, MESSAGE_ENTER_EASE, MotionMessageScrollerItem } from "@/components/ask-message";
import { applyStreamEvent, parseEvents } from "@/components/ask-sse";
import { useVisitorSession } from "@/components/use-visitor-session";
import { ArrowUp, Code2, CornerDownRight, Lightbulb, Square, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import styles from "./ask-chat.module.css";

const suggestedQuestions = [
  "你的工程经历和目前关注的方向是什么？",
  "最近有哪些关于 Agent 长期运行的实践？",
  "哪些开源项目值得持续关注？",
  "最近的每日关注里提到了什么检索思路？",
];

const suggestionIcons = [UserRound, Lightbulb, Code2];

function AssistantWelcome() {
  const greeting = useRef<HTMLParagraphElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = greeting.current;
    if (!element) return;
    const measure = () => {
      setWidth(element.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={styles.welcomeHeader}>
      <div className={styles.welcomeWalker} style={{ width }}>
        {width > 0 && <div className={styles.welcomeRise}><SpriteWalker /></div>}
      </div>
      <p ref={greeting}>我是陈远的 AI 助手，想了解什么？</p>
    </div>
  );
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const shouldFollowLatest = useRef(true);
  const isProgrammaticScroll = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const snapshotRead = useRef(false);
  const { ensureVisitorSession, isRetryingSession, retryVisitorSession, visitorId } = useVisitorSession(textareaRef);

  useLayoutEffect(() => {
    // Lazy Markdown can suspend and reconnect layout effects. Restore only once
    // per chat instance, never over a live response with its saved partial snapshot.
    if (snapshotRead.current) return;
    snapshotRead.current = true;
    const snapshot = readAskChatSnapshot();
    if (snapshot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 水合后、绘制前恢复浏览器会话，避免 SSR 不一致和草稿闪烁。
      setMessages(snapshot.messages);
      setQuestion(snapshot.question);
      setUsedSuggestions(snapshot.messages.filter((message) => message.role === "user").map((message) => message.content));
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) writeAskChatSnapshot({ messages, question });
  }, [messages, question, restored]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => () => {
    // 卸载（离开路由）时中止进行中的流式请求，避免对已卸载组件空跑完整回答。
    requestController.current?.abort();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const resize = () => {
      const minHeight = 22;
      const maxHeight = 112;
      textarea.style.height = "0px";
      const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };
    resize();
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      resize();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [question]);

  useEffect(() => {
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
    const timer = setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), delay);
    return () => clearTimeout(timer);
  }, []);

  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !shouldFollowLatest.current) return;

    isProgrammaticScroll.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    window.requestAnimationFrame(() => {
      isProgrammaticScroll.current = false;
    });
  }, []);

  useEffect(() => {
    if (!shouldFollowLatest.current) return;
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToLatest]);

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  };

  const submit = async (suggestion?: string) => {
    const trimmedQuestion = (suggestion ?? question).trim();
    if (!trimmedQuestion || isStreaming || visitorId === "unavailable") return;

    const session = await ensureVisitorSession();
    if (session.visitorId === "unavailable") return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    if (suggestedQuestions.includes(trimmedQuestion)) {
      setUsedSuggestions((current) => [...current, trimmedQuestion]);
    }
    shouldFollowLatest.current = true;
    setQuestion("");
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
      requestController.current = null;
      setIsStreaming(false);
    }
  };

  const canSubmit = Boolean(question.trim() && visitorId !== "unavailable" && !isStreaming);

  // 追问引导：回答完成后给出还没用过的建议问题，沿用空态的细线行语言；
  // 点击只填入组合器并聚焦，是否发送仍由访客决定。
  const lastMessage = messages[messages.length - 1];
  const followUpQuestions = suggestedQuestions.filter((item) => !usedSuggestions.includes(item));
  const showFollowUps = !isStreaming
    && lastMessage?.role === "assistant"
    && lastMessage.isComplete
    && !lastMessage.interruption
    && Boolean(lastMessage.content)
    && followUpQuestions.length > 0;
  const fillSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
    textareaRef.current?.focus();
  };

  const inputProps: ComponentProps<"textarea"> = {
    "aria-describedby": visitorId === "unavailable" ? "ask-session-status" : undefined,
    "aria-invalid": visitorId === "unavailable",
    "aria-label": "输入问题",
    disabled: visitorId === "unavailable",
    onChange: (event) => setQuestion(event.target.value),
    onFocus: () => void ensureVisitorSession(),
    onKeyDown: (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
        event.preventDefault();
        void submit();
      }
    },
    placeholder: "想问些什么…",
    ref: textareaRef,
    rows: 1,
    value: question,
  };

  return (
    <section aria-label="问一问" className={styles.root}>

      <MessageScrollerProvider autoScroll={false} defaultScrollPosition="end">
        <MessageScroller className={styles.scroller}>
          <MessageScrollerViewport
            aria-label="问答记录"
            className={styles.viewport}
            onKeyDown={(event) => {
              if (["ArrowUp", "Home", "PageUp", " "].includes(event.key)) {
                shouldFollowLatest.current = false;
              }
            }}
            onScroll={(event) => {
              if (isProgrammaticScroll.current) return;
              const viewport = event.currentTarget;
              shouldFollowLatest.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 24;
            }}
            onTouchMove={() => {
              shouldFollowLatest.current = false;
            }}
            onWheel={(event) => {
              if (event.deltaY < 0) shouldFollowLatest.current = false;
            }}
            ref={viewportRef}
          >
            <MessageScrollerContent
              aria-busy={isStreaming}
              className={styles.messages}
            >
              {messages.length === 0 ? (
                <MotionMessageScrollerItem
                  animate={{ y: "0rem" }}
                  className={styles.emptyItem}
                  initial={prefersReducedMotion ? false : { y: "0.4rem" }}
                  messageId="ask-empty-state"
                  transition={{ duration: EMPTY_ENTER_DURATION, ease: MESSAGE_ENTER_EASE }}
                >
                  <Empty className={styles.empty}>
                    <AssistantWelcome />
                    <EmptyContent className={styles.suggestions}>
                      {suggestedQuestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                        <motion.span
                          animate={{ y: 0 }}
                          initial={prefersReducedMotion ? false : { y: "0.3rem" }}
                          key={suggestion}
                          transition={{
                            delay: prefersReducedMotion ? 0 : 0.15 + suggestionIndex * 0.05,
                            duration: 0.24,
                            ease: MESSAGE_ENTER_EASE,
                          }}
                        >
                          <Button onClick={() => void submit(suggestion)} size="sm" type="button" variant="ghost">
                            {(() => { const Icon = suggestionIcons[suggestionIndex]; return <Icon aria-hidden="true" data-icon="inline-start" />; })()}
                            {suggestion}
                          </Button>
                        </motion.span>
                      ))}
                    </EmptyContent>
                  </Empty>
                </MotionMessageScrollerItem>
              ) : null}

                {messages.map((message, index) => (
                  <AskMessageItem
                    isStreamingPlaceholder={isStreaming && index === messages.length - 1}
                    key={message.id}
                    message={message}
                    onRetry={message.interruption?.kind === "error" && !isStreaming ? () => {
                      const previousQuestion = messages[index - 1];
                      if (previousQuestion?.role !== "user") return;
                      fillSuggestion(previousQuestion.content);
                    } : undefined}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}

              {showFollowUps ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={styles.followups}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                  transition={{ duration: 0.24, ease: MESSAGE_ENTER_EASE }}
                >
                  <div className={styles.suggestions}>
                    {followUpQuestions.slice(0, 1).map((suggestion) => (
                      <Button
                        key={suggestion}
                        onClick={() => void submit(suggestion)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <CornerDownRight aria-hidden="true" data-icon="inline-start" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            aria-label="回到最新消息"
            behavior={prefersReducedMotion ? "auto" : "smooth"}
            className={styles.scrollToLatest}
            onClick={() => {
              shouldFollowLatest.current = true;
              window.requestAnimationFrame(scrollToLatest);
            }}
          />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className={styles.drawerComposer} data-ask-composer>
          <textarea {...inputProps} className={styles.drawerInput} />
          <div className={styles.drawerActions}>
            <button aria-label={isStreaming ? "停止生成" : "发送问题"} className={styles.drawerSend}
              disabled={!isStreaming && !canSubmit}
              onClick={isStreaming ? () => requestController.current?.abort() : undefined}
              type={isStreaming ? "button" : "submit"}>
              {isStreaming ? <Square aria-hidden="true" size={13} fill="currentColor" /> : <ArrowUp aria-hidden="true" size={15} strokeWidth={3} />}
            </button>
          </div>
        </div>
        {visitorId === "unavailable" ? (
          <div className={styles.sessionRecovery}>
            <p id="ask-session-status" role={isRetryingSession ? "status" : "alert"}>
              {isRetryingSession
                ? "正在重新建立浏览器会话…"
                : "浏览器会话未建立，暂时无法发送。请检查网络或隐私设置后重试。"}
            </p>
            <Button
              className={styles.sessionRetry}
              disabled={isRetryingSession}
              onClick={() => void retryVisitorSession()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isRetryingSession ? "正在重试…" : "重试建立会话"}
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
