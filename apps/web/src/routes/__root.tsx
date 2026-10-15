import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import { OpeningLoader } from "@/components/opening-loader";
import { RouteError, RouteNotFound } from "@/components/route-fallbacks";
import { SITE_NAME, SITE_URL } from "@/lib/site";

import "../globals.css";

// 站点仅提供浅色主题：固定 color-scheme，避免系统深色模式改写表单控件与滚动条；
// 支持此提示的手机浏览器在键盘弹出时压缩内容视口，组合器随可用高度排布。
const VIEWPORT_META = {
  name: "viewport",
  content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      VIEWPORT_META,
      { name: "color-scheme", content: "light" },
      { title: SITE_NAME },
      { name: "description", content: "陈远的个人网站：工作履历、工程实践与每日关注。" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_NAME },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:locale", content: "zh_CN" },
      { property: "og:description", content: "用持续更新的策展、开源判读与项目实践证明工程身份。" },
      { property: "og:image", content: `${SITE_URL}/opengraph-image` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: SITE_NAME },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_NAME },
      { name: "twitter:description", content: "用持续更新的策展、开源判读与项目实践证明工程身份。" },
      { name: "twitter:image", content: `${SITE_URL}/opengraph-image` },
    ],
    links: [
      { rel: "alternate", type: "application/rss+xml", href: "/feed.xml" },
    ],
  }),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: RootComponent,
});

function RootComponent() {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      {/* TanStack Start 的文档约定就是真实 <head> + HeadContent，不适用 next/head 规则。 */}
      {/* eslint-disable-next-line next/no-head-element -- TanStack Start 根文档 */}
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#site-main">跳到主要内容</a>
        <OpeningLoader />
        <div id="site-canvas">
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
