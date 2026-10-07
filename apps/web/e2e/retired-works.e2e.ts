import { expect, test } from "./helpers/loader-key.ts";

test("retired works routes return 404 and have no navigation", async ({ app, screen, browser }) => {
  // waitForResponse 需要已打开的应用页；首个 404 导航前先落一次首页。
  await app.open("/");
  for (const path of ["/works", "/works/personal-site", "/works/waker"]) {
    // app.open 不返回响应；404 状态取自导航文档响应本身。
    const [response] = await Promise.all([
      browser.waitForResponse(`**${path}`),
      app.open(path),
    ]);
    expect(response.status).toBe(404);
    await expect(screen.getByRole("heading", "这页档案不在这里", { exact: false })).toBeVisible();
  }
  for (const width of [1440, 390, 320]) {
    await browser.setViewport({ width, height: 900 });
    await app.open("/");
    await expect(browser.locator('a[href^="/works"]')).toHaveCount(0);
  }
  for (const path of ["/sitemap.xml", "/feed.xml"]) {
    const response = await fetch(new URL(path, app.baseUrl));
    expect(response.ok).toBe(true);
    expect(await response.text()).not.toContain("/works");
  }
});
