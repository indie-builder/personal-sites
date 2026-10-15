import { Await, createFileRoute } from "@tanstack/react-router";

import { TaggedCurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchCurationFeed } from "@/src/functions/content";

// 策展投影随部署打包进 data/curation.sqlite，本页读本地库；
// 缓存只对页面外壳有意义，内容更新以重新部署为准。
export const Route = createFileRoute("/curation")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: () => fetchCurationFeed({ data: { limit: CURATION_PAGE_SIZE, offset: 0 } }),
  head: () => ({
    links: canonicalLinks("/curation"),
    meta: [
      { name: "description", content: "陈远从 X 持续收录并写下策展解析的判断流。" },
      { title: "每日关注｜陈远" },
    ],
  }),
  component: CurationPage,
});

function CurationPage() {
  const feed = Route.useLoaderData();
  return (
    <FeedPage label="每日关注" section="daily">
      <Await promise={feed}>
        {({ page, tags }) => <TaggedCurationStream initialHasMore={page.hasMore} initialItems={page.items} tags={tags} />}
      </Await>
    </FeedPage>
  );
}
