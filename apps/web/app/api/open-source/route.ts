import { OPEN_SOURCE_PAGE_SIZE } from "@/lib/open-source-types";
import { getOpenSourcePage } from "@/lib/open-source";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 开源关注的公开列表 JSON（安卓 App 消费）：读随部署打包的本地 sqlite，
// 分页档位 20，参数与响应契约和 /api/curation 完全一致。
export const GET = createPaginatedFeedRoute({
  label: "开源关注",
  maxLimit: 50,
  pageStep: OPEN_SOURCE_PAGE_SIZE,
  readPage: getOpenSourcePage,
});
