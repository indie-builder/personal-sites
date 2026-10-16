import { createFileRoute } from "@tanstack/react-router";

import { getAiNewsArchive } from "@/lib/ai-news-archive.server";
import { archiveMetadata } from "@site/public-data/ai-news/archive.mjs";

export const Route = createFileRoute("/api/health/ai-news/archive")({
  server: {
    handlers: {
      GET: () => {
        const metadata = archiveMetadata(getAiNewsArchive());
        return Response.json(metadata, { status: metadata ? 200 : 503, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
