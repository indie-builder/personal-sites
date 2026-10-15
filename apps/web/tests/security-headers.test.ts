import { describe, expect, it } from "vitest";

import { SECURITY_HEADERS, STATIC_IMAGE_CACHE_CONTROL } from "@/lib/security-headers";

// 安全头的事实来源是 lib/security-headers：nitro routeRules 在 vite.config.ts
// 里引用这两个常量下发（原 next.config headers() 的等价物）。
describe("security headers", () => {
  it("applies browser hardening headers to every route", () => {
    expect(SECURITY_HEADERS).toEqual({
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });

  it("caches unhashed static images for a week with background revalidation", () => {
    expect(STATIC_IMAGE_CACHE_CONTROL).toBe("public, max-age=604800, stale-while-revalidate=86400");
  });
});
