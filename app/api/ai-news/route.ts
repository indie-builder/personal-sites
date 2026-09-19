import { getAiNewsPage } from "@/lib/ai-news";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 每日动态直读 Supabase 公开投影：分页档位固定为客户端的 PAGE_SIZE=50，
// offset 取整把 CDN 缓存键收敛到有限档位，避免随机分页参数打穿 Supabase。
export const GET = createPaginatedFeedRoute({
  label: "每日动态",
  maxLimit: 100,
  pageStep: 50,
  readPage: getAiNewsPage,
});
