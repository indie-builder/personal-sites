import { Effect } from "effect";
import type { Metadata } from "next";

import { readMusePreviews } from "@site/public-data/portfolio/muse.mjs";

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import { getPortfolioDatabase } from "@/lib/portfolio/data.server";
import { withCanonical } from "@/lib/metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/portfolio"),
  description: "陈远的设计与工程作品集：布局图鉴、灵感集、工具目录、AI 词典、问答与文字游戏。",
  title: "作品集｜陈远",
};

export default async function PortfolioPage() {
  const musePreviews = await Effect.runPromise(readMusePreviews(getPortfolioDatabase(), 4));
  return (
    <PortfolioShell hideMasthead label="作品集">
      <PortfolioOverview musePreviews={musePreviews} />
    </PortfolioShell>
  );
}
