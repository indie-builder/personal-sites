import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public discovery endpoints remain machine readable", async ({ request }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
    ["/feed.xml", "application/rss+xml"],
    ["/opengraph-image", "image/png"],
  ] as const) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()["content-type"], path).toContain(type);
  }

  const health = await request.get("/api/health/data");
  const healthBody = await health.json();
  expect(health.status()).toBe(healthBody.healthy ? 200 : 503);
  expect(healthBody).toMatchObject({
    askIndex: { healthy: true, missingFts: 0, orphanFts: 0 },
    database: { healthy: true, quickCheck: "ok" },
  });
  expect(healthBody.aiNews).not.toHaveProperty("lastError");
});

test("curation feeds have no automatically detectable accessibility violations", async ({ page }) => {
  // reducedMotion 排除入场动画中途测出的对比度假阳性。
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/curation", "/design", "/douyin", "/open-source"]) {
    await page.goto(path);
    await expect(page.locator(".curation-home__feed li").first()).toBeVisible();
    // Render offscreen rows before auditing: content-visibility placeholders have stale child geometry.
    await page.addStyleTag({ content: ".curation-home__feed li { content-visibility: visible; contain-intrinsic-size: none; }" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, path).toEqual([]);
  }
});
