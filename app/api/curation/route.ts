import { getCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 读随部署打包的本地 sqlite（不经 unstable_cache）；分页档位固定为客户端的
// PAGE_SIZE=20，与 /api/ai-news 的参数语义保持一致。客户端按 id 去重，
// 取整带来的重复条目会被丢弃。
export const GET = createPaginatedFeedRoute({
  label: "策展内容",
  maxLimit: 50,
  pageStep: 20,
  readPage: getCurationPage,
});
