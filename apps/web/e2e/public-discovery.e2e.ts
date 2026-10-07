import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

test("public discovery endpoints remain machine readable", async ({ app }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
    ["/feed.xml", "application/rss+xml"],
    ["/opengraph-image", "image/png"],
  ] as const) {
    const response = await fetch(new URL(path, app.baseUrl));
    expect(response.ok, path).toBe(true);
    expect(response.headers.get("content-type"), path).toContain(type);
  }

  const health = await fetch(new URL("/api/health/data", app.baseUrl));
  const healthBody = await health.json();
  expect(health.status).toBe(healthBody.healthy ? 200 : 503);
  expect(healthBody).toMatchObject({
    askIndex: {
      healthy: true, searchableDocuments: expect.any(Number),
      missingFts: 0, orphanFts: 0, missingPostings: 0, extraPostings: 0,
    },
    database: { healthy: true, quickCheck: "ok" },
  });
  expect(healthBody.aiNews).not.toHaveProperty("lastError");
  expect((await fetch(new URL("/api/health/ai-news", app.baseUrl))).status).toBe(404);
  const archive = await fetch(new URL("/api/health/ai-news/archive", app.baseUrl));
  expect(archive.status).toBe(200);
  expect(await archive.json()).toMatchObject({ digest: expect.any(String) });
});

test("curation feeds have no automatically detectable accessibility violations", async ({ app, browser }) => {
  // reducedMotion 排除入场动画中途测出的对比度假阳性。
  await emulateReducedMotion(browser);
  // AxeBuilder 绑定 Playwright Page；框架无底层 page 通道，改为注入同版本 axe-core
  // 后在页面内跑同一默认规则集（等价其 legacy axe.run 路径），断言同一 violations 契约。
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  for (const path of ["/curation", "/design", "/douyin", "/open-source"]) {
    await app.open(path);
    await expect(browser.locator(".curation-home__feed li").first()).toBeVisible();
    // Render offscreen rows before auditing: content-visibility placeholders have stale child geometry.
    await browser.evaluate((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
      return null;
    }, ".curation-home__feed li { content-visibility: visible; contain-intrinsic-size: none; }");
    const violations = await browser.evaluate(() => {
      const axe = (window as typeof window & {
        axe?: { run: (context: unknown) => Promise<{ violations: { id: string }[] }> };
      }).axe;
      if (!axe) throw new Error("axe-core init script 未注入");
      return axe.run(document).then((results) => results.violations);
    });
    expect(violations, path).toEqual([]);
  }
});
