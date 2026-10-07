import { expect, test } from "./helpers/loader-key.ts";
import { openAssistant } from "./helpers/assistant.ts";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

test("standalone Ask is retired while the character drawer remains available", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  // waitForResponse 需要已打开的页面；404 状态取自导航文档响应本身，先落一次首页。
  await app.open("/");
  const [response] = await Promise.all([
    browser.waitForResponse("**/ask"),
    app.open("/ask"),
  ]);
  expect(response.status).toBe(404);
  await expect(screen.getByRole("heading", "这页档案不在这里", { exact: false })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await browser.setViewport({ width, height: 900 });
    const dialog = await openAssistant(app, screen, browser, width);
    await expect(browser.locator('a[href="/ask"]')).toHaveCount(0);
    await expect(dialog.getByRole("button", /检索范围|清空对话/)).toHaveCount(0);
    await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();
    await browser.keyboard.press("Escape");
  }
  const sitemap = await fetch(new URL("/sitemap.xml", app.baseUrl));
  expect(sitemap.ok).toBe(true);
  expect(await sitemap.text()).not.toMatch(/<loc>[^<]*\/ask<\/loc>/);
});
