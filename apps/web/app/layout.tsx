import type { Metadata, Viewport } from "next";

import { OpeningLoader } from "@/components/opening-loader";
import { RSS_TYPES } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

import "./globals.css";

export const viewport: Viewport = {
  // 站点仅提供浅色主题：固定 color-scheme，避免系统深色模式改写表单控件与滚动条。
  colorScheme: "light",
  // 支持此提示的手机浏览器在键盘弹出时压缩内容视口，组合器随可用高度排布。
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  description:
    "陈远的个人网站：工作履历、工程实践与每日关注。",
  metadataBase: new URL(SITE_URL),
  alternates: {
    types: RSS_TYPES,
  },
  openGraph: {
    description: "用持续更新的策展、开源判读与项目实践证明工程身份。",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: "website",
    url: SITE_URL,
  },
  title: SITE_NAME,
  twitter: {
    card: "summary_large_image",
    description: "用持续更新的策展、开源判读与项目实践证明工程身份。",
    title: SITE_NAME,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body>
        <a className="skip-link" href="#site-main">跳到主要内容</a>
        <OpeningLoader />
        <div id="site-canvas">{children}</div>
      </body>
    </html>
  );
}
