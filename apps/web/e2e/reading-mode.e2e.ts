import { expect, test } from "./helpers/loader-key.ts";

// 沉浸阅读：把手默认不可见，靠近接缝才浮出；收起后身份轨消失、内容居中。
test("profile rail can collapse into an immersive reading column", async ({ app, browser }) => {
  await browser.setViewport({ height: 950, width: 1440 });
  await app.open("/prompts");
  const toggle = browser.locator(".profile-reading-toggle");
  // 默认不进可访问性树（无感），靠近接缝才浮现。
  await expect(toggle).toBeHidden();

  // 指针靠近接缝时浮出，远离后淡回。
  await browser.mouse.move(900, 480);
  await browser.mouse.move(560, 480);
  await expect(toggle).toBeVisible();

  const readFeed = () => browser.evaluate(() => {
    const box = document.querySelector(".curation-home__feed")!.getBoundingClientRect();
    return { left: Math.round(box.left), width: Math.round(box.width) };
  });
  // 把手紧贴身份轨右缘，不能飘到栏内或压住正文。
  const alignment = await browser.evaluate(() => {
    const rail = document.querySelector(".curation-home__profile")!.getBoundingClientRect();
    const feed = document.querySelector(".curation-home__feed")!.getBoundingClientRect();
    const handle = document.querySelector(".profile-reading-toggle")!.getBoundingClientRect();
    return { railRight: Math.round(rail.right), handleRight: Math.round(handle.right), feedLeft: Math.round(feed.left) };
  });
  expect(Math.abs(alignment.handleRight - alignment.railRight)).toBeLessThanOrEqual(2);
  expect(alignment.handleRight).toBeLessThan(alignment.feedLeft);

  const before = await readFeed();
  await toggle.click();
  await expect.poll(() => browser.evaluate(() => document.body.dataset.profileCollapsed ?? null)).toBe("true");
  expect(await browser.evaluate(() => Boolean((document.querySelector(".curation-home__profile") as HTMLElement | null)?.offsetParent))).toBe(false);
  const after = await readFeed();
  // 收起后阅读列保持原有宽度并整体左移，而不是被拉伸成满屏长行。
  expect(after.width).toBe(before.width);
  expect(after.left).toBeLessThan(before.left);
  expect(after.left).toBeGreaterThan(0);
  expect(await browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 恢复：身份轨回来，焦点落回把手。
  await toggle.click();
  await expect.poll(() => browser.evaluate(() => Boolean((document.querySelector(".curation-home__profile") as HTMLElement | null)?.offsetParent))).toBe(true);
  expect(await browser.evaluate(() => document.activeElement?.classList.contains("profile-reading-toggle") ?? false)).toBe(true);
});

test("the reading handle stays out of the way on phones", async ({ app, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/prompts");
  await expect(browser.locator(".profile-reading-toggle")).toBeHidden();
});
