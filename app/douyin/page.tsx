import type { Metadata } from "next";
import { Suspense } from "react";

import { CurationStream } from "@/components/curation-stream";
import { FeedPage, FeedSkeleton } from "@/components/page-shell";
import { getDouyinCurationPage } from "@/lib/curation";
import { withCanonical } from "@/lib/metadata";

// 与 /curation 一致：策展投影随部署打包进 data/curation.sqlite，本页读本地库；
// revalidate 只对页面外壳有意义，内容更新以重新部署为准。
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/douyin"),
  description: "陈远从抖音收藏视频中收录并写下策展解析的判断流。",
  title: "抖音收藏｜陈远",
};

async function DouyinFeed() {
  const douyinPage = await getDouyinCurationPage(0, 20);
  return (
    <CurationStream
      apiPath="/api/douyin"
      emptyLabel="暂无已发布的抖音收藏条目。"
      initialHasMore={douyinPage.hasMore}
      initialItems={douyinPage.items}
      loadErrorMessage="暂时无法加载更多抖音收藏。"
      loadedAllLabel="已加载全部抖音收藏"
      snapshotKey="douyin-stream-v1"
    />
  );
}

export default function DouyinPage() {
  // 壳（个人信息栏、版块导航）立即渲染，列表数据经 Suspense 流式补进。
  return (
    <FeedPage label="抖音收藏" section="douyin">
      <Suspense fallback={<FeedSkeleton />}>
        <DouyinFeed />
      </Suspense>
    </FeedPage>
  );
}
