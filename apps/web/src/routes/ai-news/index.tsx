import { Await, createFileRoute } from "@tanstack/react-router";

import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedPage } from "@/components/page-shell";
import { AI_NEWS_PAGE_SIZE } from "@/lib/ai-news-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchAiNewsPage } from "@/src/functions/content";

// 缓存 60 秒，过期后由下一次请求触发后台合并 SQLite 历史与 Supabase 增量。
export const Route = createFileRoute("/ai-news/")({
  headers: () => ({ "Cache-Control": pageCacheControl(60) }),
  loader: () => ({ feed: fetchAiNewsPage({ data: { limit: AI_NEWS_PAGE_SIZE, offset: 0 } }) }),
  head: () => ({
    links: canonicalLinks("/ai-news"),
    meta: [
      { name: "description", content: "陈远每日跟踪的 AI 与 Agent 工程动态，按日分组的连续阅读流。" },
      { title: "每日动态｜陈远" },
    ],
  }),
  component: AiNewsPage,
});

function AiNewsPage() {
  const { feed } = Route.useLoaderData();
  // 复用身份轨与版块导航，数据组件保留 Suspense 边界。
  return (
    <FeedPage label="每日动态" section="ai-news">
      <Await promise={feed}>
        {(aiNewsPage) => <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />}
      </Await>
    </FeedPage>
  );
}
