import { Effect } from "effect";
import type { Metadata } from "next";

import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedPage } from "@/components/page-shell";
import { getAiNewsPage } from "@/lib/ai-news";
import { AI_NEWS_PAGE_SIZE } from "@/lib/ai-news-types";
import { withCanonical } from "@/lib/metadata";

// 缓存 60 秒，过期后由下一次请求触发后台合并 SQLite 历史与 Supabase 增量。
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: withCanonical("/ai-news"),
  description: "陈远每日跟踪的 AI 与 Agent 工程动态，按日分组的连续阅读流。",
  title: "每日动态｜陈远",
};

async function AiNewsFeed() {
  const aiNewsPage = await Effect.runPromise(getAiNewsPage(0, AI_NEWS_PAGE_SIZE));
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

export default function AiNewsPage() {
  // 复用身份轨与版块导航，数据组件保留 Suspense 边界。
  return (
    <FeedPage label="每日动态" section="ai-news">
      <AiNewsFeed />
    </FeedPage>
  );
}
