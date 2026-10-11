import { test } from "@e2e-dev/web";
import { expect } from "e2e";

for (const width of [320, 390, 1440]) {
  test(`作品预览在 ${width}px 完整显示并可暂停`, async ({ app, browser, screen }) => {
    await browser.setViewport({ width, height: 900 });
    await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
    await app.open("/portfolio");
    await screen.getByRole("button", "暂停预览").tap();
    await expect(screen.getByRole("button", "播放预览")).toBeVisible();
    await expect.poll(() => browser.evaluate(() => {
      const link = document.querySelector('a[aria-label="打开布局参考"]');
      if (!link) return false;
      const boundary = link.getBoundingClientRect();
      const books = [...link.querySelectorAll('[data-preview] > div > span')];
      return books.length === 8 && books.every((book) => {
        const rect = book.getBoundingClientRect();
        return rect.left >= boundary.left && rect.right <= boundary.right;
      });
    })).toBe(true);
    await expect.poll(() => browser.evaluate(() => {
      const scope = document.querySelector("[data-preview-paused]");
      return Boolean(scope && scope.getAnimations({ subtree: true }).every((animation) => animation.playState !== "running")
        && [...scope.querySelectorAll("video")].every((video) => video.paused));
    })).toBe(true);
    await screen.getByRole("link", "打开AI 问答").scrollIntoView();
    await expect(screen.getByText("示例数据", { exact: true })).toBeVisible();
    const content = await browser.evaluate(() => {
      const preview = document.querySelector("[data-chat-preview]");
      return preview ? [...preview.querySelectorAll("strong,small,em")].every((element) => getComputedStyle(element).visibility !== "hidden" && Number(getComputedStyle(element).opacity) > 0) : false;
    });
    expect(content).toBe(true);
  });
}
