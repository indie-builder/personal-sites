import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DictionaryMap } from "@/components/portfolio/dictionary-map";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import styles from "./dictionary-shell.module.css";

export const metadata: Metadata = {
  title: "AI Coding 词典",
  description: "在知识网中探索 AI Coding 术语，中英对照阅读。",
};

// 词典运行时是冻结的本地 iframe 文档，全屏画布上保留浮动返回（源站 canvasHeader 行为）。
export default function AiCodingDictionaryPage() {
  return (
    <PortfolioShell hideMasthead label="AI Coding 词典">
      <div className={styles.canvasBar}>
        <Link aria-label="返回作品集" className={styles.back} href="/portfolio">
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.6} />
          作品集
        </Link>
      </div>
      <DictionaryMap />
    </PortfolioShell>
  );
}
