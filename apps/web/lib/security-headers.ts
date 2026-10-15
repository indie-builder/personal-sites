/** 全站安全响应头（原 next.config headers() 的等价物，经 nitro routeRules 下发）。 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/** public/ 静态资源没有内容哈希，给一周浏览器缓存而非 immutable。 */
export const STATIC_IMAGE_CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=86400";
