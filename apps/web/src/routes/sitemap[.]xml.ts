import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { getSitemapRecords } from "@/lib/discovery.server";
import { PUBLIC_FEED_CACHE_CONTROL } from "@/lib/paginated-route";
import { SITE_URL } from "@/lib/site";

const staticPaths = ["", "/ai-news", "/curation", "/prompts", "/design", "/douyin", "/open-source"];

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// 原 Next app/sitemap.ts（revalidate = 300）的等价物：CDN 头沿用信息流的
// s-maxage=300 + SWR，条目结构保持 <urlset> 语义不变。
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const dynamic = await Effect.runPromise(getSitemapRecords());
        const entries: Array<{ changeFrequency: string; lastModified?: string; priority: number; url: string }> = [
          ...staticPaths.map((path, index) => ({
            changeFrequency: path === "" ? "daily" : "hourly",
            priority: path === "" ? 1 : index <= 2 ? 0.9 : 0.7,
            url: `${SITE_URL}${path}`,
          })),
          ...dynamic.map((item) => ({
            changeFrequency: "weekly",
            ...(item.lastModified ? { lastModified: item.lastModified } : {}),
            priority: 0.6,
            url: item.url,
          })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    ${entry.lastModified ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : ""}
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
        return new Response(xml, {
          headers: {
            "Cache-Control": PUBLIC_FEED_CACHE_CONTROL,
            "Content-Type": "application/xml; charset=utf-8",
          },
        });
      },
    },
  },
});
