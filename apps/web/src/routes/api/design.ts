import { createFileRoute } from "@tanstack/react-router";

import { getDesignCurationPage } from "@/lib/curation";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

export const Route = createFileRoute("/api/design")({
  server: {
    handlers: {
      GET: ({ request }) =>
        createPaginatedFeedRoute({
          label: "设计收藏",
          maxLimit: 50,
          pageStep: CURATION_PAGE_SIZE,
          readPage: getDesignCurationPage,
        })(request),
    },
  },
});
