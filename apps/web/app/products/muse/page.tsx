import type { Metadata } from "next";
import { Suspense } from "react";
import { Effect } from "effect";

import { readMuseCardsPage, readMuseTabs } from "@site/public-data/portfolio/muse.mjs";

import { PlateWall } from "@/components/portfolio/plate-wall";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import { getPortfolioDatabase } from "@/lib/portfolio/data.server";
import styles from "./page.module.css";

export const MUSE_BATCH = 24;

export const metadata: Metadata = {
  title: "灵感集 · 图像、界面与动效",
  description: "浏览图像、界面与动效，发现值得参考的设计与创作者，直接访问作品出处。",
};

export default function MusePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <PortfolioShell label="灵感集" productSlug="muse">
      {/* searchParams 转发进 Suspense 内 await：预渲染期必然挂起，外壳不预渲染网格，
          首屏只由请求时分叉输出（服务端按当前筛选，设计契约） */}
      <Suspense
        fallback={
          <p role="status" className={`portfolio-quiet ${styles.fade}`}>
            正在准备灵感列表…
          </p>
        }
      >
        <MuseGrid searchParams={searchParams} />
      </Suspense>
    </PortfolioShell>
  );
}

async function MuseGrid({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.cat === "string" ? params.cat : "全部";
  // 全量列表留在服务端，只下发当前筛选的首屏窗口；追加走 /api/posts 分片
  const { page, tabs } = await Effect.runPromise(
    Effect.all({
      page: readMuseCardsPage(getPortfolioDatabase(), { q, category, offset: 0, limit: MUSE_BATCH }),
      tabs: readMuseTabs(getPortfolioDatabase()),
    }),
  );
  return (
    <PlateWall
      categories={tabs}
      items={page.items}
      total={page.total}
      batchSize={MUSE_BATCH}
    />
  );
}
