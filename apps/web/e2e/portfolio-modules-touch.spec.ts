import { expect, test, type Page } from "./helpers/loader-key.playwright";


async function touchSwipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 6) {
  const session = await page.context().newCDPSession(page);
  const points = Array.from({ length: steps + 1 }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / steps,
    y: from.y + ((to.y - from.y) * index) / steps,
  }));
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points[0]!] });
  for (let index = 1; index <= steps; index += 1) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [points[index]!] });
    await page.waitForTimeout(16);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

test.describe("touch media", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  // 独立模块画廊没有内层滚动区域：触摸纵滑只滚动文档，手势不拦截卡片点按。
  test("vertical touch gesture scrolls the page natively and a later card tap still opens the work", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 320 });
    await page.goto("/portfolio");
    const box = await page.locator("[data-portfolio-gallery]").boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = Math.min(box.y + box.height / 2, 280);
    await touchSwipe(page, { x, y }, { x, y: Math.max(100, y - 160) });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20);
    expect(page.url()).not.toContain("/products/");
    await page.getByRole("link", { name: "打开布局参考" }).tap();
    await expect(page).toHaveURL(/\/products\/layout-compositions$/u);
  });
});
