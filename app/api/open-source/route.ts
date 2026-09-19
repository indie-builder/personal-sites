import { getOpenSourcePage } from "@/lib/open-source";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 开源关注的公开列表 JSON（安卓 App 消费）：读随部署打包的本地 sqlite，
// 分页档位 20，参数与响应契约和 /api/curation 完全一致。
export const GET = createPaginatedFeedRoute({
  label: "开源关注",
  maxLimit: 50,
  pageStep: 20,
  readPage: getOpenSourcePage,
});
