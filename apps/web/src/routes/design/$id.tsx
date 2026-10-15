import { createFileRoute, notFound } from "@tanstack/react-router";

import { DesignEntryLoading } from "@/components/curation-entry-loading";
import { buildCurationEntryHead, CurationEntryView } from "@/components/curation-entry";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchCurationEntry } from "@/src/functions/content";

// 迁移前本路由禁止 loading.tsx：设计板块会为 design 状态非 include 的条目抛出
// notFound，旧框架依赖"响应未开始流式"才能返回真实 404。迁移后 loader 在渲染前
// 完整求值，notFound 一定发生在响应头写出之前，加载占位（pendingComponent）与
// 真实 404 不再互斥；e2e/curation-isr.spec.ts 守护此契约。
export const Route = createFileRoute("/design/$id")({
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: async ({ params }) => {
    const entry = await fetchCurationEntry({ data: { context: "design", id: params.id } });
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ loaderData }) => buildCurationEntryHead({ context: "design", entry: loaderData.entry }),
  pendingComponent: DesignEntryLoading,
  component: DesignEntryPage,
});

function DesignEntryPage() {
  const { entry } = Route.useLoaderData();
  return <CurationEntryView context="design" entry={entry} />;
}
