import { getAiNewsPage } from "@/lib/ai-news";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 每日动态合并 SQLite 历史与 Supabase 增量：分页档位固定为客户端的 PAGE_SIZE=50，
// offset 取整把 CDN 缓存键收敛到有限档位，避免随机分页参数打穿 Supabase。
export const GET = createPaginatedFeedRoute({
  label: "每日动态",
  maxLimit: 100,
  maxOffset: Number.MAX_SAFE_INTEGER,
  pageStep: 50,
  readPage: getAiNewsPage,
});
