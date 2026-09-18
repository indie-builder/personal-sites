import type { Metadata } from "next";
import { Suspense } from "react";

import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedPage, FeedSkeleton } from "@/components/page-shell";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";

// 动态渲染、每请求直读 Supabase 公开投影，打开即最新。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "陈远每日跟踪的 AI 与 Agent 工程动态，按日分组的连续阅读流。",
  title: "每日动态｜陈远",
};

async function AiNewsFeed() {
  const aiNewsPage = await getAiNewsPage(0, AI_NEWS_LIST_LIMIT);
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

export default function AiNewsPage() {
  // 壳（个人信息栏、版块导航）立即渲染，动态数据经 Suspense 流式补进。
  return (
    <FeedPage label="每日动态" section="ai-news">
      <Suspense fallback={<FeedSkeleton />}>
        <AiNewsFeed />
      </Suspense>
    </FeedPage>
  );
}
