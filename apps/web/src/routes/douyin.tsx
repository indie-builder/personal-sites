import { Await, createFileRoute } from "@tanstack/react-router";

import { CurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchDouyinPage } from "@/src/functions/content";

// 与 /curation 一致：策展投影随部署打包进 data/curation.sqlite，本页读本地库；
// 缓存只对页面外壳有意义，内容更新以重新部署为准。
export const Route = createFileRoute("/douyin")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: () => fetchDouyinPage({ data: { limit: CURATION_PAGE_SIZE, offset: 0 } }),
  head: () => ({
    links: canonicalLinks("/douyin"),
    meta: [
      { name: "description", content: "陈远从抖音收藏视频中收录并写下策展解析的判断流。" },
      { title: "抖音收藏｜陈远" },
    ],
  }),
  component: DouyinPage,
});

function DouyinPage() {
  const { douyinPage } = Route.useLoaderData();
  // 壳（个人信息栏、版块导航）立即渲染，列表数据经 Suspense 流式补进。
  return (
    <FeedPage label="抖音收藏" section="douyin">
      <Await promise={douyinPage}>
        {(page) => (
          <CurationStream
            apiPath="/api/douyin"
            emptyLabel="暂无已发布的抖音收藏条目。"
            initialHasMore={page.hasMore}
            initialItems={page.items}
            loadErrorMessage="暂时无法加载更多抖音收藏。"
            loadedAllLabel="已加载全部抖音收藏"
            snapshotKey="douyin-stream-v1"
          />
        )}
      </Await>
    </FeedPage>
  );
}
