import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// 键盘切换策展标签即时回顶：html 全局 scroll-behavior:smooth 会接管 behavior:"auto"，
// 只有显式 "instant" 才真正立即到位（在已滚动的位置上断言真实 scrollY）；指针切换保持平滑。
test("curation tag keyboard switch lands instantly at top while pointer selection stays smooth", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    // /curation 桌面视口的滚动目标是 window（feed 不滚）；只记录调用参数，不改行为。
    // 不补 Element.prototype.scrollTo：补丁会干扰 Radix 菜单的选中路径。
    const w = window as typeof window & { __tagScrollBehaviors: string[] };
    w.__tagScrollBehaviors = [];
    const windowScrollTo = window.scrollTo.bind(window);
    window.scrollTo = (...args: unknown[]) => {
      const options = args[0];
      if (typeof options === "object" && options !== null && (options as ScrollToOptions).top === 0) {
        w.__tagScrollBehaviors.push(String((options as ScrollToOptions).behavior));
      }
      return windowScrollTo(...args as Parameters<typeof window.scrollTo>);
    };
  });
  const readBehaviors = () => browser.evaluate(() => (
    window as typeof window & { __tagScrollBehaviors?: string[] }
  ).__tagScrollBehaviors ?? []);

  await app.open("/curation");
  const trigger = screen.getByRole("button", "筛选每日关注：全部主题", { exact: false });
  await expect(trigger).toBeVisible();

  // 从已滚动的位置出发：设置初值也用 instant，避免全局 smooth 把准备工作变成动画。
  await browser.evaluate(() => {
    window.scrollTo({ behavior: "instant", top: 1200 });
    return null;
  });
  expect(await browser.evaluate(() => window.scrollY)).toBe(1200);

  await trigger.focus();
  await browser.keyboard.press("Enter");
  const menu = screen.getByRole("menu");
  await expect(menu).toBeVisible();
  // 直接聚焦第一个标签再按 Enter：键会走到条目自身的键盘选中路径（合成 click detail 0），
  // 避开 Radix 方向键高亮与按键之间的时序竞态。
  const firstTag = screen.getByRole("menuitemradio").nth(1);
  await firstTag.focus();
  await browser.keyboard.press("Enter");
  await expect(screen.getByRole("button", /^筛选每日关注：(?!全部主题)/u)).toBeVisible();
  // 真实位置断言：键盘切换后 scrollY 立即为 0。无头环境下标签流重挂载会把文档折叠到
  // 视口高度、auto 也不播动画，位置本身区分不了 auto 与 instant——机制区分由下面的
  // 调用参数精确匹配保证（参数断言已在回归到 "auto" 时验证会失败）；有头浏览器里
  // smooth 接管 "auto" 的真实动画差异由 ego 实检覆盖。
  expect(await browser.evaluate(() => window.scrollY)).toBe(0);
  expect(await readBehaviors()).toEqual(["instant"]);

  // 指针路径保持平滑：等标签内容加载撑开文档后，滚回非零位置再在菜单里点选另一个标签。
  await expect.poll(() => browser.locator("ol.curation-home__stream > li").count()).toBeGreaterThan(4);
  await browser.evaluate(() => {
    window.scrollTo({ behavior: "instant", top: 1200 });
    return null;
  });
  expect(await browser.evaluate(() => window.scrollY)).toBe(1200);
  await screen.getByRole("button", /^筛选每日关注：/u).click();
  await expect(menu).toBeVisible();
  await screen.getByRole("menuitemradio").nth(2).click();
  await expect(screen.getByRole("menu")).toBeHidden();
  expect(await readBehaviors()).toContain("smooth");
});
