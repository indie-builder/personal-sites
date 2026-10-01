import { Effect } from "effect";
import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedErrorBoundary, FeedRecoveryTarget } from "@/components/focus-stream-error-boundary";
import { FeedSkeleton } from "@/components/page-shell";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";
import { withCanonical } from "@/lib/metadata";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  alternates: withCanonical("/"),
};

// 动态渲染、每请求合并 SQLite 历史与 Supabase 增量：每日动态 5 分钟一变，不用 ISR
// 时间缓存——否则缓存过期后的首次访问仍先拿到旧页面。
export const dynamic = "force-dynamic";

async function HomeNews() {
  const aiNewsPage = await Effect.runPromise(getAiNewsPage(0, AI_NEWS_LIST_LIMIT));
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

// 数据读取留在壳内的 Suspense 中，身份轨与刊头只挂载一次。
export default function HomePage() {
  return (
    <main className="curation-home curation-home--mobile-home" id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit mobileSection="home" />
      <SectionMotionLifecycle section="home" />
      <section
        aria-label="每日动态"
        className="curation-home__feed site-section-motion"
        data-feed-recovery-root
        tabIndex={-1}
      >
        <ContentSectionNavigation current="ai-news" />
        <FeedErrorBoundary label="每日动态">
          <Suspense fallback={<FeedSkeleton label="每日动态" />}>
            <FeedRecoveryTarget>
              <HomeNews />
            </FeedRecoveryTarget>
          </Suspense>
        </FeedErrorBoundary>
      </section>
    </main>
  );
}
