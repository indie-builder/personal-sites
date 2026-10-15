import { createFileRoute } from "@tanstack/react-router";

import { getDouyinCurationPage } from "@/lib/curation";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 与 /api/curation 读同一份随部署打包的本地 sqlite，只是来源收窄为抖音。
export const Route = createFileRoute("/api/douyin")({
  server: {
    handlers: {
      GET: ({ request }) =>
        createPaginatedFeedRoute({
          label: "抖音收藏",
          maxLimit: 50,
          pageStep: CURATION_PAGE_SIZE,
          readPage: getDouyinCurationPage,
        })(request),
    },
  },
});
