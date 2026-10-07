import { expect } from "e2e";
import type { App } from "e2e";
import type { Browser } from "@e2e-dev/web";
import type { Screen } from "e2e";

export async function openAssistant(app: App, screen: Screen, browser: Browser) {
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  const viewportWidth = await browser.evaluate(() => window.innerWidth);
  await app.open(viewportWidth <= 900 ? "/" : "/curation");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).click();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();
  return dialog;
}
