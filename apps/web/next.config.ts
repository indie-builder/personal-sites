import path from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  outputFileTracingExcludes: {
    "/*": ["../../data/sensitive/**", "../../knowledge/sensitive/**", "../../var/**", "../../tools/smaug/**"],
  },
  images: {
    // 作品集媒体热链白名单（本地副本优先，缺失时回退上游 CDN）。
    remotePatterns: [
      "media.inspora.design",
      "cdn.jsdelivr.net",
      "cdn.bestdesignsonx.com",
      "cdn.collectui.com",
      "pbs.twimg.com",
    ].map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  outputFileTracingIncludes: {
    "/*": ["data/curation.sqlite", "data/ai-news.sqlite", "data/portfolio.sqlite"],
  },
  experimental: {
    // 每日动态/首页改为动态渲染后，SPA 导航默认每次都重新打服务端（含返回列表），
    // 表现为明显的卡顿。给客户端 Router Cache 30 秒窗口：会话内往返即时响应，
    // 超过窗口或整页刷新仍直读数据库，数据新鲜度不受影响。
    staleTimes: { dynamic: 30 },
  },
  poweredByHeader: false,
  typedRoutes: true,
  // public/ 下的静态资源没有内容哈希，给一周浏览器缓存而非 immutable。
  async headers() {
    return [
      {
        headers: [
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
        source: "/:path*",
      },
      {
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
        source: "/images/:path*",
      },
      {
        // 词典冻结运行时是唯一允许同源 framing 的文档；其余路由保持 DENY。
        // 后写规则覆盖先写的同键标头（见 Next headers 文档）。
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
        source: "/ai-coding-atlas/index.html",
      },
    ];
  },
};

export default nextConfig;
