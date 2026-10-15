import { Await, createFileRoute } from "@tanstack/react-router";

import { OpenSourceStream } from "@/components/open-source-stream";
import { FeedPage } from "@/components/page-shell";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchOpenSourceEntries } from "@/src/functions/content";

// 公开投影随部署打包进 data/curation.sqlite，页面按五分钟缓存节奏更新。
export const Route = createFileRoute("/open-source")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: () => fetchOpenSourceEntries(),
  head: () => ({
    links: canonicalLinks("/open-source"),
    meta: [
      { name: "description", content: "陈远持续关注并写下中文判读的开源项目。" },
      { title: "开源关注｜陈远" },
    ],
  }),
  component: OpenSourcePage,
});

function OpenSourcePage() {
  const { entries } = Route.useLoaderData();
  return (
    <FeedPage label="开源关注" section="open-source">
      <Await promise={entries}>
        {(openSourceEntries) => <OpenSourceStream entries={openSourceEntries} />}
      </Await>
    </FeedPage>
  );
}
