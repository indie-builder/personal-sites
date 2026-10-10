import { Effect } from "effect";
import type { Metadata } from "next";

import {
  layoutEntries,
  portfolioProducts,
  personalSitePromo,
  toolPreview,
} from "@site/public-data/portfolio/products.mjs";
import { readMusePreviews } from "@site/public-data/portfolio/muse.mjs";

import { PortfolioOverview, type PortfolioOverviewProduct } from "@/components/portfolio/portfolio-overview";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import { getPortfolioDatabase } from "@/lib/portfolio/data.server";
import { withCanonical } from "@/lib/metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/portfolio"),
  description: "陈远的设计与工程作品集：布局图鉴、灵感集、工具目录、AI 词典、问答与文字游戏。",
  title: "作品集｜陈远",
};

function overviewProducts(musePreviews: { src: string; alt: string }[]): PortfolioOverviewProduct[] {
  const layoutPreview = layoutEntries.find((entry) => entry.thumb)?.thumb;
  const tools = toolPreview.map((tool) => tool.name);
  return portfolioProducts.map((product) => {
    switch (product.slug) {
      case "muse":
        return {
          ...product,
          preview: musePreviews.slice(0, 4).map((item) => ({ kind: "image" as const, src: item.src, alt: item.alt })),
        };
      case "layout-compositions":
        return layoutPreview
          ? { ...product, preview: [{ kind: "image" as const, src: layoutPreview, alt: "布局图鉴内页缩略图" }] }
          : { ...product, preview: [] };
      case "personal-sites":
        return {
          ...product,
          preview: [{ kind: "image" as const, src: personalSitePromo.poster, alt: "个人网站首页预览" }],
        };
      case "design-engineer-tools":
        return { ...product, preview: [{ kind: "text" as const, text: tools.join(" · ") }] };
      default:
        return { ...product, preview: [] };
    }
  });
}

export default async function PortfolioPage() {
  const musePreviews = await Effect.runPromise(readMusePreviews(getPortfolioDatabase(), 4));
  return (
    <PortfolioShell label="作品集">
      <PortfolioOverview products={overviewProducts(musePreviews)} />
    </PortfolioShell>
  );
}
