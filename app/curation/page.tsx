import type { Metadata } from "next";

import { CurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { getCurationPage } from "@/lib/curation";

// 策展投影随部署打包进 data/curation.sqlite（next.config 的 outputFileTracingIncludes），
// 本页读本地库；revalidate 只对页面外壳有意义，内容更新以重新部署为准。
export const revalidate = 300;

export const metadata: Metadata = {
  description: "陈远从 X 持续收录并写下策展解析的判断流。",
  title: "每日关注｜陈远",
};

export default async function CurationPage() {
  const curationPage = await getCurationPage();
  return (
    <FeedPage label="每日关注" section="daily">
      <CurationStream initialHasMore={curationPage.hasMore} initialItems={curationPage.items} />
    </FeedPage>
  );
}
