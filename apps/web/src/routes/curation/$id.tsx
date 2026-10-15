import { createFileRoute, notFound } from "@tanstack/react-router";

import { CurationEntryLoading } from "@/components/curation-entry-loading";
import { buildCurationEntryHead, CurationEntryView } from "@/components/curation-entry";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchCurationEntry } from "@/src/functions/content";

// 注意：板块归属为 curation 的剪报详情；设计板块的同一份条目在 /design/$id。
// 首次访问按需生成，随后五分钟内复用页面结果。
export const Route = createFileRoute("/curation/$id")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: async ({ params }) => {
    const entry = await fetchCurationEntry({ data: { context: "curation", id: params.id } });
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ loaderData }) => (loaderData ? buildCurationEntryHead({ context: "curation", entry: loaderData.entry }) : {}),
  pendingComponent: CurationEntryLoading,
  component: CurationEntryPage,
});

function CurationEntryPage() {
  const { entry } = Route.useLoaderData();
  return <CurationEntryView context="curation" entry={entry} />;
}
