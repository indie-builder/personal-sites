import type { Metadata } from "next";
import { Suspense } from "react";

import { CurationStream } from "@/components/curation-stream";
import { FeedPage, FeedSkeleton } from "@/components/page-shell";
import { getDesignCurationPage } from "@/lib/curation";
import { withCanonical } from "@/lib/metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/design"),
  description: "陈远在 X 点赞与收藏的设计相关内容，视频可直接在站内播放。",
  title: "设计收藏｜陈远",
};

async function DesignFeed() {
  const designPage = await getDesignCurationPage(0, 20);
  return (
    <CurationStream
      apiPath="/api/design"
      emptyLabel="暂时没有高置信度的设计收藏。"
      initialHasMore={designPage.hasMore}
      initialItems={designPage.items}
      loadErrorMessage="暂时无法加载更多设计收藏。"
      snapshotKey="design-stream-v1"
      variant="design"
    />
  );
}

export default function DesignPage() {
  return (
    <FeedPage label="设计收藏" section="design">
      <Suspense fallback={<FeedSkeleton />}>
        <DesignFeed />
      </Suspense>
    </FeedPage>
  );
}
