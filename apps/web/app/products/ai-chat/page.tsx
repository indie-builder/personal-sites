import type { Metadata } from "next";

import { AiChat } from "@/components/portfolio/ai-chat";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import styles from "./chat-shell.module.css";

export const metadata: Metadata = {
  title: "AI 问答",
  description: "选择或创建智能体，用对话生成清晰、可交互的回答。",
};

// 单列聊天界面：保留源站 480px 工作台与移动端整屏行为，模式行隐藏以复用高度。
export default function AiChatPage() {
  return (
    <PortfolioShell hideMasthead label="AI 问答" productSlug="ai-chat">
      <div className={styles.chat}>
        <AiChat />
      </div>
    </PortfolioShell>
  );
}
