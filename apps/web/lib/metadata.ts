import { SITE_NAME, SITE_URL } from "@/lib/site";

/** 全站 RSS 订阅标注（原 Next alternates.types 的等价物）。 */
export const RSS_FEED_PATH = "/feed.xml";

type HeadLink = { rel: string; href: string; type?: string };

/**
 * 页面级 canonical（原 Next withCanonical().alternates 的等价物）。
 * TanStack 的 head links 按路由合并且不去重，根布局已提供唯一的 RSS 订阅标注，
 * 页面级只补 canonical，避免详情页出现两条订阅链接。
 */
export function canonicalLinks(canonicalPath: string): Array<HeadLink> {
  return [
    { rel: "canonical", href: `${SITE_URL}${canonicalPath}` },
  ];
}

// 根段的文件约定分享图（原 app/opengraph-image.tsx 的文件约定）只在站点级注入；
// 页面级覆写 openGraph 后必须显式带上，否则详情页分享卡无图。
const SITE_OG_IMAGE = {
  alt: SITE_NAME,
  height: 630,
  type: "image/png" as const,
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
};

type HeadMeta = { name?: string; property?: string; content: string };

/**
 * 详情页分享卡片覆写。原 Next 的 metadata 浅合并：页面一旦声明 openGraph 或
 * twitter 就会整体替换布局层同名字段，因此这里重复公共字段，避免分享退化为
 * 站点级文案。canonicalPath 同时作为 og:url。
 */
export function entryShareMeta({
  canonicalPath,
  description,
  title,
}: {
  canonicalPath: string;
  description: string;
  title: string;
}): { meta: Array<HeadMeta> } {
  return {
    meta: [
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${SITE_URL}${canonicalPath}` },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "zh_CN" },
      { property: "og:image", content: SITE_OG_IMAGE.url },
      { property: "og:image:width", content: String(SITE_OG_IMAGE.width) },
      { property: "og:image:height", content: String(SITE_OG_IMAGE.height) },
      { property: "og:image:alt", content: SITE_OG_IMAGE.alt },
      { property: "og:image:type", content: SITE_OG_IMAGE.type },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SITE_OG_IMAGE.url },
    ],
  };
}
