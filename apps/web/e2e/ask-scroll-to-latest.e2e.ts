import { openAssistant } from "./helpers/assistant.ts";
import { expect, test } from "./helpers/loader-key.ts";

test("Ask gives the scroll-to-latest control a mobile touch target without enlarging desktop", async ({ app, screen, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });
  await openAssistant(app, screen, browser, 390);

  const button = screen.getByRole("button", "回到最新消息", { exact: false });
  await expect(button).toBeAttached();
  // 框架无 locator.evaluate：经稳定 data-slot 在页面内直接置位按钮的可见态。
  await browser.evaluate(() => {
    document.querySelector('[data-slot="message-scroller-button"]')!.setAttribute("data-active", "true");
    return null;
  });

  await expect.poll(async () => button.boundingBox()).toMatchObject({ height: 44, width: 44 });

  await browser.setViewport({ height: 1_000, width: 1_440 });

  const desktopBox = await button.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox?.width).toBeCloseTo(28, 1);
  expect(desktopBox?.height).toBeCloseTo(28, 1);
});
