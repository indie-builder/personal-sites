import { expect, test } from "@playwright/test";

// 键盘切换策展标签即时回顶（behavior auto），指针切换保持平滑滚动（smooth）。
test("curation tag switch scrolls with behavior auto from the keyboard and smooth from the mouse", async ({ page }) => {
  await page.addInitScript(() => {
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
  const readBehaviors = () => page.evaluate(() => (
    window as typeof window & { __tagScrollBehaviors?: string[] }
  ).__tagScrollBehaviors ?? []);

  await page.goto("/curation");
  const trigger = page.getByRole("button", { name: "筛选每日关注：全部主题" });
  await expect(trigger).toBeVisible();

  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  // 直接聚焦第一个标签再按 Enter：键会走到条目自身的键盘选中路径（合成 click detail 0），
  // 避开 Radix 方向键高亮与按键之间的时序竞态。
  const firstTag = page.getByRole("menuitemradio").nth(1);
  await firstTag.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^筛选每日关注：(?!全部主题)/u })).toBeVisible();
  expect(await readBehaviors()).toContain("auto");
  expect(await readBehaviors()).not.toContain("smooth");

  // 指针路径保持平滑：菜单里选另一个标签。
  await page.getByRole("button", { name: /^筛选每日关注：/u }).click();
  await expect(menu).toBeVisible();
  await page.getByRole("menuitemradio").nth(2).click();
  await expect(page.getByRole("menu")).toBeHidden();
  expect(await readBehaviors()).toContain("smooth");
});
