import { expect, test } from "./helpers/loader-key.ts";

test("daily news category menu filters on a narrow screen", async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 320, height: 720 });
  await app.open("/ai-news");
  const trigger = screen.getByRole("button", "筛选每日动态：全部动态", { exact: false });
  await trigger.click();
  const menu = screen.getByRole("menu");
  // 框架 locator 无 evaluate：transformOrigin / 视口右缘读取走页内单匹配，poll 重读与旧断言一致。
  await expect.poll(() => browser.evaluate(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    if (menus.length !== 1) throw new Error(`expected exactly one menu, found ${menus.length}`);
    const menu = menus[0] as HTMLElement;
    const style = getComputedStyle(menu);
    const [x, y] = style.transformOrigin.split(" ").map(parseFloat);
    return Math.abs(x - menu.offsetWidth) < 1 && y === 0;
  })).toBe(true);
  const category = menu.getByRole("menuitemradio").last();
  const label = (await category.textContent())?.trim() ?? "";
  expect(label).not.toBe("全部动态");
  expect(await browser.evaluate(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    if (menus.length !== 1) throw new Error(`expected exactly one menu, found ${menus.length}`);
    return menus[0].getBoundingClientRect().right;
  })).toBeLessThanOrEqual(320);
  await category.click();
  await expect(menu).toBeHidden();
  await expect(screen.getByRole("button", `筛选每日动态：${label}`, { exact: false })).toBeVisible();
  await screen.getByRole("button", `筛选每日动态：${label}`, { exact: false }).click();
  await expect(menu.getByRole("menuitemradio", label, { exact: false })).toHaveAttribute("data-state", "checked");
  await browser.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
