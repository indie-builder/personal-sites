import { Effect } from "effect";
import type { Metadata } from "next";

import { TaggedCurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { getCurationPage, getCurationTags } from "@/lib/curation";
import { withCanonical } from "@/lib/metadata";

// 策展投影随部署打包进 data/curation.sqlite（next.config 的 outputFileTracingIncludes），
// 本页读本地库；revalidate 只对页面外壳有意义，内容更新以重新部署为准。
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/curation"),
  description: "陈远从 X 持续收录并写下策展解析的判断流。",
  title: "每日关注｜陈远",
};

async function CurationFeed() {
  const { page, tags } = await Effect.runPromise(Effect.all({ page: getCurationPage(), tags: getCurationTags() }));
  return <TaggedCurationStream initialHasMore={page.hasMore} initialItems={page.items} tags={tags} />;
}

export default function CurationPage() {
  return (
    <FeedPage label="每日关注" section="daily">
      <CurationFeed />
    </FeedPage>
  );
}
