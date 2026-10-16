import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            "User-Agent: *",
            "Allow: /",
            "Disallow: /api/",
            "",
            `Sitemap: ${SITE_URL}/sitemap.xml`,
            "",
          ].join("\n"),
          {
            headers: {
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        ),
    },
  },
});
