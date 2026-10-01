import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320, 844]) {
  test(`open-source topic menu filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/open-source");
    const section = page.getByRole("region", { name: "已判读的开源项目" });
    const rows = section.locator("ol > li");
    const total = await rows.count();
    const trigger = page.getByRole("button", { name: "筛选开源关注：全部主题" });
    await expect(trigger).toBeVisible();
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect(menu.getByRole("menuitemradio", { name: `全部主题 · ${total}`, exact: true })).toHaveAttribute("data-state", "checked");
    const skills = menu.getByRole("menuitemradio", { name: /^Skills 与工作流 · /u });
    const count = Number((await skills.innerText()).split(" · ").at(-1));
    await skills.click();
    await expect(menu).toBeHidden();
    const selected = page.getByRole("button", { name: "筛选开源关注：Skills 与工作流" });
    await expect(selected).toBeVisible();
    await expect(rows).toHaveCount(count);
    await expect(section.locator(".stream-date-toolbar")).toContainText(`${count} 个项目`);
    expect(await rows.locator("a > div:first-child > span:first-child").allTextContents()).toEqual(Array(count).fill("Skills 与工作流"));
    await expect(selected).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("data-state", "open");
    await expect(skills).toHaveAttribute("data-state", "checked");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(selected).toBeFocused();
    await selected.click();
    await menu.getByRole("menuitemradio", { name: `全部主题 · ${total}`, exact: true }).click();
    await expect(rows).toHaveCount(total);
    await expect(trigger).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
