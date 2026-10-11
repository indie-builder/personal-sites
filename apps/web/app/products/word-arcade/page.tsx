import type { Metadata } from "next";

import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import { WordArcade } from "@/components/portfolio/word-arcade";
import styles from "./arcade-shell.module.css";

export const metadata: Metadata = {
  title: "文字游乐场",
  description: "把文字变成游戏：打砖块、贪吃蛇、文字射击、飞字打靶与文字跑酷。",
};

// 游戏画布需要整块可用高度；模式行隐藏，返回作品集出口由共用壳提供。
export default function WordArcadePage() {
  return (
    <PortfolioShell hideMasthead label="文字游乐场" productSlug="word-arcade">
      <div className={styles.arcade}>
        <WordArcade />
      </div>
    </PortfolioShell>
  );
}
