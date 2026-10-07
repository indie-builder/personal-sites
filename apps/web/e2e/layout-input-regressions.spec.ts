import { expect, test } from "./helpers/loader-key.playwright";

// 留守件（与 curation-detail-responsive.spec.ts 同类）：断言 prefers-reduced-motion 的
// CSS @media 计算样式，以及旧用例末段在 reduce 条件下的收缩滚动终态。e2e 运行器
// （@e2e-dev/web）没有 emulateMedia，引擎也不模拟该媒体特性；matchMedia 补丁只影响
// JS 现读，改不了 CSS 级联，无法等价表达。可搬迁部分已入 layout-input-regressions.e2e.ts。
test("mobile profile collapse transition is neutralized under reduced motion", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const profile = page.locator(".curation-home__profile");
  const offset = await profile.locator("[data-mobile-navigation]").evaluate((element) => (element as HTMLElement).offsetTop);
  const expanded = (await profile.boundingBox())!;
  await expect(profile).toHaveCSS("transition-duration", "0s");
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 600 }));
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-offset);
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(expanded.y);
});
