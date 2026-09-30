import { getCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";
import { z } from "zod";

// 读随部署打包的本地 sqlite（不经 unstable_cache）；分页档位固定为客户端的
// PAGE_SIZE=20，与 /api/ai-news 的参数语义保持一致。客户端按 id 去重，
// 取整带来的重复条目会被丢弃。
export async function GET(request: Request) {
  const tag = z.string().trim().min(1).max(40).nullable().safeParse(new URL(request.url).searchParams.get("tag"));
  if (!tag.success) return Response.json({ error: "分类参数无效。" }, { status: 400 });
  return createPaginatedFeedRoute({
    label: "策展内容",
    maxLimit: 50,
    pageStep: 20,
    readPage: (offset, limit) => getCurationPage(offset, limit, tag.data),
  })(request);
}
