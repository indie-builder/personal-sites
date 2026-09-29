import { getDesignCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

export const GET = createPaginatedFeedRoute({
  label: "设计收藏",
  maxLimit: 50,
  pageStep: 20,
  readPage: getDesignCurationPage,
});
