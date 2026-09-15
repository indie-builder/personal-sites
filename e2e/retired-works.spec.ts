import { expect, test } from "@playwright/test";

test("retired works routes return 404 and have no navigation or search scope", async ({ page, request }) => {
  await page.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  for (const path of ["/works", "/works/personal-site", "/works/waker"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这页档案不在这里" })).toBeVisible();
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ask");
    await expect(page.locator('a[href^="/works"]')).toHaveCount(0);
    await page.getByRole("button", { name: /检索范围/u }).click();
    await expect(page.getByRole("menuitemradio")).toHaveText(["全部", "关于我", "每日动态", "每日关注", "开源关注"]);
    await page.keyboard.press("Escape");
  }
  for (const path of ["/sitemap.xml", "/feed.xml"]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(await response.text()).not.toContain("/works");
  }
});
