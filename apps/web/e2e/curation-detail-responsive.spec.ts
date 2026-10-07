import { expect, test } from "./helpers/loader-key.playwright";

const LONG_MEDIA_DETAIL_PATH = "/curation/2093968800316293400";

// 触摸设备契约用例：e2e 运行器（@e2e-dev/web）无 hasTouch/isMobile 设备仿真，
// 框架 tap 实为鼠标点击，(hover: none) and (pointer: coarse) 恒为 false，
// tap 后图片会被 hover 规则放大——两条断言在该框架均不可等价表达，暂留 Playwright。
test.describe("touch media", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  test("tapping detail media keeps the image unscaled", async ({ page }) => {
    await page.goto(LONG_MEDIA_DETAIL_PATH);
    const media = page.locator(".curation-detail__media a").first();
    const image = media.locator("img");
    await media.evaluate((element) => element.addEventListener("click", (event) => event.preventDefault()));
    expect(await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches)).toBe(true);
    await media.tap();
    await page.waitForTimeout(250);
    await expect(image).toHaveCSS("transform", "none");
  });
});
