import { expect, test } from "@playwright/test";

test("daily news category menu filters on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/ai-news");
  const trigger = page.getByRole("button", { name: "筛选每日动态：全部动态" });
  await trigger.click();
  const menu = page.getByRole("menu");
  const category = menu.getByRole("menuitemradio").last();
  const label = (await category.innerText()).trim();
  expect(label).not.toBe("全部动态");
  expect(await menu.evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
  await category.click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: `筛选每日动态：${label}` })).toBeVisible();
  await page.getByRole("button", { name: `筛选每日动态：${label}` }).click();
  await expect(menu.getByRole("menuitemradio", { name: label })).toHaveAttribute("data-state", "checked");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
