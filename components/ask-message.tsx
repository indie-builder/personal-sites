"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { memo } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import type { ChatMessage } from "@/components/ask-chat-snapshot";

import { STREAM_EASE } from "./motion-tokens";
import styles from "./ask-chat.module.css";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);
const MotionSearch = motion.create(Search);

// react-markdown 生态只在收到第一条回答时才需要，按需加载。
const AskAnswerMarkdown = dynamic(() => import("@/components/ask-answer-markdown").then((module) => module.AskAnswerMarkdown));

export { MotionMessageScrollerItem };

export const MESSAGE_ENTER_DURATION = 0.24;
export const EMPTY_ENTER_DURATION = 0.32;
export const MESSAGE_ENTER_EASE = STREAM_EASE;

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

export function AskMessageItem({ isStreamingPlaceholder, message, onRetry, prefersReducedMotion }: {
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
