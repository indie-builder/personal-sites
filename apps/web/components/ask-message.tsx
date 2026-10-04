"use client";

import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";

import { AskAnswer } from "@/components/ask-answer";
import { Button } from "@/components/ui/button";
import { MessageScroller } from "@shadcn/react/message-scroller";
import type { ChatMessage } from "@/components/ask-chat-snapshot";

import { STREAM_EASE } from "./motion-tokens";
import styles from "./ask-chat.module.css";

const MotionMessageScrollerItem = motion.create(MessageScroller.Item);
const MotionSearch = motion.create(Search);

export { MotionMessageScrollerItem };

const MESSAGE_ENTER_DURATION = 0.24;

// 消息与回调引用未变时，跳过整条消息的重渲染。
export const AskMessageItem = memo(function AskMessageItem({ isStreamingPlaceholder, message, onContinue, onRetry, prefersReducedMotion }: {
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
  onContinue?: (question: string) => void;
  onRetry?: () => void;
  prefersReducedMotion: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <MotionMessageScrollerItem
      animate={{ opacity: 1, y: "0rem" }}
      className={styles.messageItem}
      data-slot="message-scroller-item"
      initial={prefersReducedMotion
        ? false
        : { opacity: 0, y: "0.4rem" }}
      messageId={message.id}
      scrollAnchor={isUser}
      transition={{ duration: MESSAGE_ENTER_DURATION, ease: STREAM_EASE }}
    >
      <div className={`group/message ${styles.message}`} data-align={isUser ? "end" : "start"} data-slot="message">
        <div className={styles.messageContent} data-slot="message-content">
          {/* 对齐方向已表达说话人；铭牌只保留给读屏，不占垂直节奏。 */}
          <div className="sr-only" data-slot="message-header">
            {isUser ? "你" : "归档助手"}
          </div>
          {message.content ? (
            <div className={styles.bubbleFrame} data-align={isUser ? "end" : "start"} data-slot="bubble" data-variant={isUser ? "default" : "ghost"}>
              <div aria-live={isUser ? undefined : "polite"} className={`${styles.bubbleContent} ${isUser ? styles.userBubble : styles.assistantBubble}`} data-slot="bubble-content">
                {!isUser
                  ? <AskAnswer isStreaming={!message.isComplete} onContinue={onContinue} source={message.content} />
                  : message.content}
              </div>
            </div>
          ) : isStreamingPlaceholder ? (
            <div className={styles.status} data-slot="marker" role="status">
              <span aria-hidden="true" className={styles.statusIcon} data-slot="marker-icon">
                <MotionSearch
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                  initial={false}
                  transition={prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 1.15, ease: "easeInOut", repeat: Infinity }}
                />
              </span>
              <span className={styles.statusContent} data-slot="marker-content">
                正在查找资料并整理回答…
              </span>
            </div>
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
            <details className={styles.sources} data-slot="message-footer">
              <summary className={styles.sourcesSummary}>
                <span>参考资料 · {message.citations.length} 篇</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <ol aria-label="回答来源" className={styles.citations}>
                {message.citations.map((source, sourceIndex) => (
                  <li key={source.id}>
                    <a className={styles.citation} href={source.sourceUrl}>
                      <span>【{sourceIndex + 1}】{source.title}{source.section ? ` · ${source.section}` : ""}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      </div>
    </MotionMessageScrollerItem>
  );
});
