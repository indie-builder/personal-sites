import type { Metadata } from "next";

import { DictionaryMap } from "@/components/portfolio/dictionary-map";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";

export const metadata: Metadata = {
  title: "AI Coding 词典",
  description: "在知识网中探索 AI Coding 术语，中英对照阅读。",
};

// 词典运行时是冻结的本地 iframe 文档；返回作品集出口由共用壳提供。
export default function AiCodingDictionaryPage() {
  return (
    <PortfolioShell hideMasthead label="AI Coding 词典" productSlug="ai-coding-dictionary">
      <DictionaryMap />
    </PortfolioShell>
  );
}
