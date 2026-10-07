import { Effect } from "effect";
import { AiNewsStream } from "@/components/ai-news-stream";
import { FeedErrorBoundary, FeedRecoveryTarget } from "@/components/focus-stream-error-boundary";
import { FeedSkeleton } from "@/components/page-shell";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getAiNewsPage } from "@/lib/ai-news";
import { AI_NEWS_PAGE_SIZE } from "@/lib/ai-news-types";
import { withCanonical } from "@/lib/metadata";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  alternates: withCanonical("/"),
};

// 缓存 60 秒，过期后由下一次请求触发后台合并 SQLite 历史与 Supabase 增量。
export const revalidate = 60;

async function HomeNews() {
  const aiNewsPage = await Effect.runPromise(getAiNewsPage(0, AI_NEWS_PAGE_SIZE));
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

// 数据读取留在壳内的 Suspense 中，身份轨与刊头只挂载一次。
export default function HomePage() {
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
