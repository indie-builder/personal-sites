import { expect, test } from "./helpers/loader-key.playwright";

// 留守件（与 curation-detail-responsive.spec.ts 同类）：断言 prefers-reduced-motion 的
// CSS @media 计算样式。e2e 运行器（@e2e-dev/web）没有 emulateMedia，引擎也不模拟该
// 媒体特性；matchMedia 补丁只影响 JS 现读，改不了 CSS 级联，无法等价表达。
// 可搬迁部分已入 layout-input-regressions.e2e.ts。
test("mobile profile collapse transition is neutralized under reduced motion", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  await expect(page.locator(".curation-home__profile")).toHaveCSS("transition-duration", "0s");
});
