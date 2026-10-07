import { expect, type Page } from "@playwright/test";

export async function openAssistant(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await page.goto((page.viewportSize()?.width ?? 1280) <= 900 ? "/" : "/curation");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  const dialog = page.getByRole("dialog", { name: "问一问" });
  await expect(dialog.getByRole("textbox", { name: "输入问题" })).toBeVisible();
  return dialog;
}
