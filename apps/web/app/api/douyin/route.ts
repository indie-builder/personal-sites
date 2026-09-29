import { getDouyinCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 与 /api/curation 读同一份随部署打包的本地 sqlite，只是来源收窄为抖音。
export const GET = createPaginatedFeedRoute({
  label: "抖音收藏",
  maxLimit: 50,
  pageStep: 20,
  readPage: getDouyinCurationPage,
});
