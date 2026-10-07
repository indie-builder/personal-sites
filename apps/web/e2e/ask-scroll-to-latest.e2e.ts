import { openAssistant } from "./helpers/assistant.ts";
import { expect, test } from "./helpers/loader-key.ts";

test("Ask gives the scroll-to-latest control a mobile touch target without enlarging desktop", async ({ app, screen, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });
  await openAssistant(app, screen, browser, 390);

  const button = screen.getByRole("button", "回到最新消息", { exact: false });
  await expect(button).toBeAttached();
  // 框架无 locator.evaluate：等价复现旧 getByRole("button", "回到最新消息")——
  // aria-label 与 data-slot 同一 button 元素，复化合物选择器且不唯一即 throw。
  await browser.evaluate(() => {
    const matches = document.querySelectorAll('[data-slot="message-scroller-button"][aria-label="回到最新消息"]');
    if (matches.length !== 1) throw new Error(`expected exactly one scroll-to-latest button, found ${matches.length}`);
    matches[0].setAttribute("data-active", "true");
    return null;
  });

  await expect.poll(async () => button.boundingBox()).toMatchObject({ height: 44, width: 44 });

  await browser.setViewport({ height: 1_000, width: 1_440 });

  const desktopBox = await button.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox?.width).toBeCloseTo(28, 1);
  expect(desktopBox?.height).toBeCloseTo(28, 1);
});
