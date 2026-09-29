import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/site";

const RSS_TYPES = { "application/rss+xml": "/feed.xml" } as const;

// app/opengraph-image.tsx 的文件约定图只在根段注入；页面级覆写 openGraph
// 后叶段不会回注，必须显式带上，否则详情页分享卡无图。
const SITE_OG_IMAGE = {
  alt: SITE_NAME,
  height: 630,
  type: "image/png" as const,
  url: "/opengraph-image",
  width: 1200,
};

/**
 * 页面级 alternates 会整体替换布局层：每个 canonical 都带上 RSS types，
 * 避免列表与详情页丢失订阅链接标注。路径由布局层的 metadataBase 补全为绝对地址。
 */
export function withCanonical(path: string): Metadata["alternates"] {
  return { canonical: path, types: RSS_TYPES };
}

/**
 * 详情页分享卡片覆写。Next 的 metadata 是浅合并：页面一旦声明 openGraph
 * 或 twitter 就会整体替换布局层同名字段，因此这里必须重复公共字段，
 * 否则分享退化为站点级文案。canonicalPath 同时作为 og:url。
 */
export function entryShareMetadata({
  canonicalPath,
  description,
  title,
}: {
  canonicalPath: string;
  description: string;
  title: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      description,
      images: [SITE_OG_IMAGE],
      locale: "zh_CN",
      siteName: SITE_NAME,
      title,
      type: "article",
      url: canonicalPath,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [SITE_OG_IMAGE.url],
      title,
    },
  };
}
