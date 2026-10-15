import { createFileRoute, useRouter, Await } from "@tanstack/react-router";
import { Suspense } from "react";

import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedErrorBoundary, FeedRecoveryTarget } from "@/components/focus-stream-error-boundary";
import { FeedSkeleton } from "@/components/page-shell";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { AI_NEWS_PAGE_SIZE } from "@/lib/ai-news-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchAiNewsPage } from "@/src/functions/content";

// 缓存 60 秒，过期后由下一次请求触发后台合并 SQLite 历史与 Supabase 增量。
export const Route = createFileRoute("/")({
  headers: () => ({ "Cache-Control": pageCacheControl(60) }),
  loader: () => fetchAiNewsPage({ data: { limit: AI_NEWS_PAGE_SIZE, offset: 0 } }),
  head: () => ({ links: canonicalLinks("/") }),
  component: HomePage,
});

function HomePage() {
  const router = useRouter();
  const { feed } = Route.useLoaderData();

  // 数据读取留在壳内的 Suspense 中，身份轨与刊头只挂载一次。
  return (
    <main className="curation-home curation-home--mobile-home" id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit mobileSection="home" />
      <SectionMotionLifecycle />
      <section
        aria-label="每日动态"
        className="curation-home__feed site-section-motion"
        data-feed-recovery-root
        tabIndex={-1}
      >
        <ContentSectionNavigation current="ai-news" />
        <FeedErrorBoundary label="每日动态" onRetry={() => void router.invalidate()}>
          <Suspense fallback={<FeedSkeleton label="每日动态" />}>
            <FeedRecoveryTarget>
              <Await promise={feed}>
                {(aiNewsPage) => <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />}
              </Await>
            </FeedRecoveryTarget>
          </Suspense>
        </FeedErrorBoundary>
      </section>
    </main>
  );
}
