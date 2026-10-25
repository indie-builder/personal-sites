import { createFileRoute, notFound } from "@tanstack/react-router";

import { PromptEntryLoading } from "@/components/curation-entry-loading";
import { buildCurationEntryHead, CurationEntryView } from "@/components/curation-entry";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchCurationEntry } from "@/src/functions/content";

// 提示词详情与 /curation/$id 是同一条公开记录；本路由只放行带「提示词」标签的条目，
// 相邻导航与返回链接都留在提示词集合内。canonical 仍指向 /curation/<id>（见 buildCurationEntryHead）。
export const Route = createFileRoute("/prompts/$id")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: async ({ params }) => {
    const entry = await fetchCurationEntry({ data: { context: "prompts", id: params.id } });
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ loaderData }) => (loaderData ? buildCurationEntryHead({ context: "prompts", entry: loaderData.entry }) : {}),
  pendingComponent: PromptEntryLoading,
  component: PromptEntryPage,
});

function PromptEntryPage() {
  const { entry } = Route.useLoaderData();
  return <CurationEntryView context="prompts" entry={entry} />;
}
