import type { Metadata } from "next";
import { Suspense } from "react";

import { OpenSourceStream } from "@/components/open-source-stream";
import { FeedPage, FeedSkeleton } from "@/components/page-shell";
import { withCanonical } from "@/lib/metadata";
import { getOpenSourceListEntries } from "@/lib/open-source";

// 公开投影随部署打包进 data/curation.sqlite，页面按五分钟 ISR 节奏更新。
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: withCanonical("/open-source"),
  description: "陈远持续关注并写下中文判读的开源项目。",
  title: "开源关注｜陈远",
};

async function OpenSourceFeed() {
  const openSourceEntries = await getOpenSourceListEntries();
  return <OpenSourceStream entries={openSourceEntries} />;
}

export default function OpenSourcePage() {
  return (
    <FeedPage label="开源关注" section="open-source">
      <Suspense fallback={<FeedSkeleton />}>
        <OpenSourceFeed />
      </Suspense>
    </FeedPage>
  );
}
