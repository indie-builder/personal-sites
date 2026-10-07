import { expect } from "e2e";
import type { App } from "e2e";
import type { Browser } from "@e2e-dev/web";
import type { Screen } from "e2e";

// browser.evaluate 需要已打开的应用页，开页前读不到视口宽度；
// 需要移动布局的调用方先 browser.setViewport 再把宽度传入，省略即桌面布局（与旧版默认一致）。
export async function openAssistant(app: App, screen: Screen, browser: Browser, viewportWidth?: number) {
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await app.open((viewportWidth ?? Number.POSITIVE_INFINITY) <= 900 ? "/" : "/curation");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).click();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();
  return dialog;
}
