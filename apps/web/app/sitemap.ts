import { Effect } from "effect";
import type { MetadataRoute } from "next";

import { getSitemapRecords } from "@/lib/discovery.server";
import { SITE_URL } from "@/lib/site";
import { portfolioProducts } from "@site/public-data/portfolio/products.mjs";

const staticPaths = ["", "/ai-news", "/curation", "/design", "/douyin", "/open-source"];

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamic = await Effect.runPromise(getSitemapRecords());
  return [
    ...staticPaths.map((path, index) => ({
      changeFrequency: path === "" ? ("daily" as const) : ("hourly" as const),
      priority: path === "" ? 1 : index <= 2 ? 0.9 : 0.7,
      url: `${SITE_URL}${path}`,
    })),
    { url: `${SITE_URL}/portfolio`, changeFrequency: "weekly", priority: 0.8 },
    ...portfolioProducts.map((product) => ({
      url: `${SITE_URL}${product.href}`,
      lastModified: product.date,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...dynamic.map((item) => ({
      changeFrequency: "weekly" as const,
      ...(item.lastModified ? { lastModified: item.lastModified } : {}),
      priority: 0.6,
      url: item.url,
    })),
  ];
}
