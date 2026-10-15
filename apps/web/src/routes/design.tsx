import { Await, createFileRoute } from "@tanstack/react-router";

import { CurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchDesignPage } from "@/src/functions/content";

export const Route = createFileRoute("/design")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: () => fetchDesignPage({ data: { limit: CURATION_PAGE_SIZE, offset: 0 } }),
  head: () => ({
    links: canonicalLinks("/design"),
    meta: [
      { name: "description", content: "陈远在 X 点赞与收藏的设计相关内容，视频可直接在站内播放。" },
      { title: "设计收藏｜陈远" },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  const { designPage } = Route.useLoaderData();
  return (
    <FeedPage label="设计收藏" section="design">
      <Await promise={designPage}>
        {(page) => (
          <CurationStream
            apiPath="/api/design"
            emptyLabel="暂时没有高置信度的设计收藏。"
            initialHasMore={page.hasMore}
            initialItems={page.items}
            loadErrorMessage="暂时无法加载更多设计收藏。"
            loadedAllLabel="已加载全部设计收藏"
            snapshotKey="design-stream-v1"
            variant="design"
          />
        )}
      </Await>
    </FeedPage>
  );
}
