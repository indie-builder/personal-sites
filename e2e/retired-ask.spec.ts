import { expect, test } from "@playwright/test";
import { openAssistant } from "./helpers/assistant";

test("standalone Ask is retired while the character drawer remains available", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/ask");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "这页档案不在这里" })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openAssistant(page);
    await expect(page.locator('a[href="/ask"]')).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /检索范围|清空对话/ })).toHaveCount(0);
    await expect(dialog.getByRole("textbox", { name: "输入问题" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toMatch(/<loc>[^<]*\/ask<\/loc>/);
});
