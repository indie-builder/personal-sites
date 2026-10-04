"use client";

import { Button } from "@/components/ui/button";
import { MessageScroller } from "@shadcn/react/message-scroller";
import { SpriteWalker } from "@/components/assistant-sprite";
import { AskMessageItem, MotionMessageScrollerItem } from "@/components/ask-message";
import { STREAM_EASE } from "@/components/motion-tokens";
import { useAskConversation } from "@/components/use-ask-conversation";
import { useMediaQuery } from "@/components/use-media-query";
import { ArrowDown, ArrowUp, Code2, CornerDownRight, Lightbulb, Square, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, type ComponentProps } from "react";

import styles from "./ask-chat.module.css";

const EMPTY_ENTER_DURATION = 0.32;

const suggestedQuestions = [
  "你的工程经历和目前关注的方向是什么？",
  "最近有哪些关于 Agent 长期运行的实践？",
  "哪些开源项目值得持续关注？",
  "最近的每日关注里提到了什么检索思路？",
];

const suggestionIcons = [UserRound, Lightbulb, Code2];

function AssistantWelcome() {
  return (
    <div className={styles.welcomeHeader}>
      <div className={styles.welcomeWalker}>
        <div className={styles.welcomeRise}><SpriteWalker /></div>
      </div>
      <p>我是陈远的 AI 助手，想了解什么？</p>
    </div>
  );
}

export function AskChat() {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const shouldFollowLatest = useRef(true);
  const isProgrammaticScroll = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    isStreaming, messages, question, setQuestion, stop, submit,
  } = useAskConversation(() => { shouldFollowLatest.current = true; });

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

  const canSubmit = Boolean(question.trim() && !isStreaming);

  // 追问引导：回答完成后给出还没用过的建议问题，沿用空态的细线行语言；
  // 点击只填入组合器并聚焦，是否发送仍由访客决定。
  const lastMessage = messages[messages.length - 1];
  const followUpQuestions = suggestedQuestions.filter((item) => !messages.some((message) => message.role === "user" && message.content === item));
  const showFollowUps = !isStreaming
    && lastMessage?.role === "assistant"
    && lastMessage.isComplete
    && !lastMessage.interruption
    && Boolean(lastMessage.content)
    && followUpQuestions.length > 0;
  const inputProps: ComponentProps<"textarea"> = {
    "aria-label": "输入问题",
    onChange: (event) => setQuestion(event.target.value),
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

      <MessageScroller.Provider autoScroll={false} defaultScrollPosition="end">
        <MessageScroller.Root className={styles.scroller}>
          <MessageScroller.Viewport
            aria-label="问答记录"
            className={styles.viewport}
            data-slot="message-scroller-viewport"
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
            <MessageScroller.Content
              aria-busy={isStreaming}
              className={styles.messages}
            >
              {messages.length === 0 ? (
                <MotionMessageScrollerItem
                  animate={{ y: "0rem" }}
                  className={styles.emptyItem}
                  initial={prefersReducedMotion ? false : { y: "0.4rem" }}
                  messageId="ask-empty-state"
                  transition={{ duration: EMPTY_ENTER_DURATION, ease: STREAM_EASE }}
                >
                  <div className={styles.empty} data-slot="empty">
                    <AssistantWelcome />
                    <div className={`${styles.emptyContent} ${styles.suggestions}`} data-slot="empty-content">
                      {suggestedQuestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                        <motion.span
                          animate={{ y: 0 }}
                          initial={prefersReducedMotion ? false : { y: "0.3rem" }}
                          key={suggestion}
                          transition={{
                            delay: prefersReducedMotion ? 0 : 0.15 + suggestionIndex * 0.05,
                            duration: 0.24,
                            ease: STREAM_EASE,
                          }}
                        >
                          <Button onClick={() => void submit(suggestion)} size="sm" type="button" variant="ghost">
                            {(() => { const Icon = suggestionIcons[suggestionIndex]; return <Icon aria-hidden="true" data-icon="inline-start" />; })()}
                            {suggestion}
                          </Button>
                        </motion.span>
                      ))}
                    </div>
                  </div>
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
                      // 与主流对话产品一致：重试直接重发原问题，输入框草稿保持不动。
                      void submit(previousQuestion.content, { preserveDraft: true });
                    } : undefined}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}

              {showFollowUps ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={styles.followups}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                  transition={{ duration: 0.24, ease: STREAM_EASE }}
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
            </MessageScroller.Content>
          </MessageScroller.Viewport>
          <MessageScroller.Button
            aria-label="回到最新消息"
            behavior={prefersReducedMotion ? "auto" : "smooth"}
            className={styles.scrollToLatest}
            data-slot="message-scroller-button"
            direction="end"
            onClick={() => {
              shouldFollowLatest.current = true;
              window.requestAnimationFrame(scrollToLatest);
            }}
            render={<Button size="icon-sm" variant="secondary" />}
          ><ArrowDown aria-hidden="true" /></MessageScroller.Button>
        </MessageScroller.Root>
      </MessageScroller.Provider>

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
              onClick={isStreaming ? stop : undefined}
              type={isStreaming ? "button" : "submit"}>
              {isStreaming ? <Square aria-hidden="true" size={13} fill="currentColor" /> : <ArrowUp aria-hidden="true" size={15} strokeWidth={3} />}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
