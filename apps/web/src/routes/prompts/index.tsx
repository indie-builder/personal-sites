import { Await, createFileRoute } from "@tanstack/react-router";

import { TaggedCurationStream } from "@/components/curation-stream";
import { FeedPage } from "@/components/page-shell";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { canonicalLinks } from "@/lib/metadata";
import { pageCacheControl } from "@/lib/page-cache";
import { fetchPromptsPage } from "@/src/functions/content";

// 提示词是每日关注里带「提示词」标签的公开子集，复用同一份策展投影与本机 SQLite；
// 筛选状态放在 URL（tag），详情页点标签可回到同类内容。
export const Route = createFileRoute("/prompts/")({
  validateSearch: (search: Record<string, unknown>): { tag?: string } =>
    typeof search.tag === "string" && search.tag.length > 0 && search.tag.length <= 40 ? { tag: search.tag } : {},
  loaderDeps: ({ search }) => ({ tag: search.tag ?? null }),
  headers: () => ({ "Cache-Control": pageCacheControl(300) }),
  loader: ({ deps }) => ({
    feed: fetchPromptsPage({ data: { limit: CURATION_PAGE_SIZE, offset: 0, tag: deps.tag } }),
    tag: deps.tag,
  }),
  head: () => ({
    links: canonicalLinks("/prompts"),
    meta: [
      { name: "description", content: "陈远收录的提示词原文、中文译文与使用解析，可按标签筛选同类内容。" },
      { title: "提示词｜陈远" },
    ],
  }),
  component: PromptsPage,
});

function PromptsPage() {
  const { feed, tag } = Route.useLoaderData();
  return (
    <FeedPage label="提示词" section="prompts">
      <Await promise={feed}>
        {({ page, tags }) => (
          <TaggedCurationStream initialHasMore={page.hasMore} initialItems={page.items} initialTag={tag} section="prompts" tags={tags} />
        )}
      </Await>
    </FeedPage>
  );
}
