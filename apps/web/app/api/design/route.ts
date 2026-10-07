import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { getDesignCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

export const GET = createPaginatedFeedRoute({
  label: "设计收藏",
  maxLimit: 50,
  pageStep: CURATION_PAGE_SIZE,
  readPage: getDesignCurationPage,
});
