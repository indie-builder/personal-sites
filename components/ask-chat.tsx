"use client";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent } from "@/components/ui/empty";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { SpriteWalker } from "@/components/assistant-sprite";
import { readAskChatSnapshot, writeAskChatSnapshot, type ChatMessage } from "@/components/ask-chat-snapshot";
import type { AskSource } from "@/lib/ask-types";
import { ArrowUp, ArrowUpRight, Code2, CornerDownRight, Lightbulb, Search, Square, UserRound } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import styles from "./ask-chat.module.css";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);
const MotionSearch = motion.create(Search);

// react-markdown 生态只在收到第一条回答时才需要，按需加载。
const AskAnswerMarkdown = dynamic(() => import("@/components/ask-answer-markdown").then((module) => module.AskAnswerMarkdown));

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

function parseEvents(buffer: string) {
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const events = chunks.flatMap((chunk) => {
    const event = /^event:\s*(.+)$/m.exec(chunk)?.[1];
    const data = /^data:\s*(.+)$/m.exec(chunk)?.[1];
    if (!event || !data) return [];
    try {
      return [{ data: JSON.parse(data) as Record<string, unknown>, event }];
    } catch {
      return [];
    }
  });
  return { events, remainder };
}

// 单条消息气泡独立 memo：流式 delta 只更新目标 message 对象引用，
// 历史消息引用保持不变即可整体跳过重渲染（含其中的 Markdown 解析）。
const AskMessageBubble = memo(function AskMessageBubble({ isStreamingPlaceholder, message, onRetry, prefersReducedMotion }: {
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
  onRetry?: () => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <Message align={message.role === "user" ? "end" : "start"} className={styles.message}>
      <MessageContent>
        {/* 对齐方向已表达说话人；铭牌只保留给读屏，不占垂直节奏。 */}
        <MessageHeader className="sr-only">
          {message.role === "user" ? "你" : "归档助手"}
        </MessageHeader>
        {message.content ? (
          <Bubble align={message.role === "user" ? "end" : "start"} variant={message.role === "user" ? "default" : "ghost"}>
            <BubbleContent aria-live={message.role === "assistant" ? "polite" : undefined} className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
              {/* 流式期间渲染纯文本：Markdown 组件对每个 delta 全量重解析是 O(n²)，
                  落定（isComplete）后才挂 ReactMarkdown；bubble 的 pre-wrap 保证换行不丢。 */}
              {message.role === "assistant" && message.isComplete
                ? <AskAnswerMarkdown source={message.content} />
                : message.content}
            </BubbleContent>
          </Bubble>
        ) : isStreamingPlaceholder ? (
          <Marker className={styles.status} role="status">
            <MarkerIcon>
              <MotionSearch
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                initial={false}
                transition={prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 1.15, ease: "easeInOut", repeat: Infinity }}
              />
            </MarkerIcon>
            <MarkerContent>
              {message.citations.length > 0
                ? "已检索公开资料，正在生成回答…"
                : "正在检索公开资料…"}
            </MarkerContent>
          </Marker>
        ) : null}
        {message.interruption ? (
          <div className={styles.interruption}>
            <p role={message.interruption.kind === "error" ? "alert" : "status"}>{message.interruption.message}</p>
            {message.interruption.kind === "error" && onRetry ? (
              <Button onClick={onRetry} size="sm" type="button" variant="ghost">重新提问</Button>
            ) : null}
          </div>
        ) : null}
        {message.role === "assistant" && message.isComplete && message.citations.length > 0 ? (
          <MessageFooter className={styles.sources}>
            {/* 回答落定后来源逐条阶梯入场；减少动态时直接静态呈现。 */}
            <ol aria-label="回答来源" className={styles.citations}>
              {message.citations.map((source, sourceIndex) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                  key={source.id}
                  transition={{
                    delay: prefersReducedMotion ? 0 : sourceIndex * 0.045,
                    duration: 0.22,
                    ease: MESSAGE_ENTER_EASE,
                  }}
                >
                  <a className={styles.citation} href={source.sourceUrl}>
                    <span>【{sourceIndex + 1}】{source.title}{source.section ? ` · ${source.section}` : ""}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </motion.li>
              ))}
            </ol>
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
});

const MESSAGE_ENTER_DURATION = 0.24;
const EMPTY_ENTER_DURATION = 0.32;
const MESSAGE_ENTER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
function AskMessageItem({ isStreamingPlaceholder, message, onRetry, prefersReducedMotion }: {
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
  onRetry?: () => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <MotionMessageScrollerItem
      animate={{ opacity: 1, y: "0rem" }}
      className={styles.messageItem}
      initial={prefersReducedMotion
        ? false
        : { opacity: 0, y: "0.4rem" }}
      messageId={message.id}
      scrollAnchor={message.role === "user"}
      transition={{ duration: MESSAGE_ENTER_DURATION, ease: MESSAGE_ENTER_EASE }}
    >
      <AskMessageBubble isStreamingPlaceholder={isStreamingPlaceholder} message={message} onRetry={onRetry} prefersReducedMotion={prefersReducedMotion} />
    </MotionMessageScrollerItem>
  );
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRetryingSession, setIsRetryingSession] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const shouldFollowLatest = useRef(true);
  const isProgrammaticScroll = useRef(false);
  const shouldFocusAfterSessionRetry = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const visitorSessionPromise = useRef<Promise<{ conversationId: string; visitorId: string }> | null>(null);
  const snapshotRead = useRef(false);

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

  // 指纹只用于限流，等用户表现出提问意图（聚焦输入框或提交）后再加载计算。
  const ensureVisitorSession = useCallback(() => {
    visitorSessionPromise.current ??= (async () => {
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
    return visitorSessionPromise.current;
  }, []);

  const retryVisitorSession = async () => {
    if (isRetryingSession) return;
    setIsRetryingSession(true);
    shouldFocusAfterSessionRetry.current = true;
    visitorSessionPromise.current = null;
    const session = await ensureVisitorSession();
    setIsRetryingSession(false);
    if (session.visitorId === "unavailable") shouldFocusAfterSessionRetry.current = false;
  };

  useLayoutEffect(() => {
    if (!visitorId || visitorId === "unavailable" || !shouldFocusAfterSessionRetry.current) return;
    shouldFocusAfterSessionRetry.current = false;
    textareaRef.current?.focus();
  }, [visitorId]);

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

    const session = await (visitorSessionPromise.current ?? ensureVisitorSession());
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
          if (item.event === "sources" && Array.isArray(item.data.sources)) {
            updateAssistant(assistantId, (message) => ({ ...message, citations: item.data.sources as AskSource[] }));
          }
          if (item.event === "text" && typeof item.data.delta === "string") {
            updateAssistant(assistantId, (message) => ({ ...message, content: `${message.content}${item.data.delta}` }));
          }
          if (item.event === "done") {
            updateAssistant(assistantId, (message) => ({ ...message, isComplete: true }));
          }
          if (item.event === "error") {
            updateAssistant(assistantId, (message) => ({
              ...message,
              interruption: {
                kind: "error",
                message: typeof item.data.message === "string" ? item.data.message : "回答暂时不可用，请稍后重试。",
              },
              isComplete: true,
            }));
          }
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
