import type { Browser } from "@e2e-dev/web";
import { expect, test } from "./helpers/loader-key.ts";

async function expectNativeDocumentScroll(browser: Browser, key: "ArrowDown" | "PageDown" | "Space") {
  await browser.evaluate(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
    return null;
  });
  await expect.poll(() => browser.evaluate(() => document.activeElement === document.body)).toBe(true);
  await browser.keyboard.press(key);
  await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test("desktop list pages keep native BODY keyboard scrolling", async ({ app, browser }) => {
  await browser.setViewport({ height: 640, width: 1_440 });
  await app.open("/design");

  await expect.poll(() => browser.evaluate(() => document.scrollingElement!.scrollHeight)).toBeGreaterThan(640);
  for (const key of ["PageDown", "Space", "ArrowDown"] as const) {
    await expectNativeDocumentScroll(browser, key);
  }

  await app.open("/curation");
  // 框架无 toHaveCSS：overflow-y 轮询读 computed style；旧 locator 页面唯一，页内单匹配直取。
  await expect.poll(() => browser.evaluate(() => {
    const feeds = document.querySelectorAll(".curation-home__feed");
    if (feeds.length !== 1) throw new Error(`expected exactly one feed, found ${feeds.length}`);
    return getComputedStyle(feeds[0]).overflowY;
  })).toBe("visible");
  await expectNativeDocumentScroll(browser, "PageDown");
});

test("mobile profile collapse preserves sticky clamping and scroll hysteresis", async ({ app, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/curation");
  const profile = browser.locator(".curation-home__profile");
  const navigation = browser.locator(".curation-home__profile [data-mobile-navigation]");
  const expanded = (await profile.boundingBox())!;
  // 旧 navigation.evaluate 读 offsetTop：profile 作用域单匹配，页内直取。
  const offset = await browser.evaluate(() => {
    const navigations = document.querySelectorAll(".curation-home__profile [data-mobile-navigation]");
    if (navigations.length !== 1) throw new Error(`expected exactly one mobile navigation, found ${navigations.length}`);
    return (navigations[0] as HTMLElement).offsetTop;
  });
  expect(offset).toBeGreaterThan(105);

  const scrollTo = (top: number) => browser.evaluate((y) => {
    window.scrollTo({ behavior: "instant", top: y });
    return null;
  }, top);
  // 框架无 toHaveCSS：top/transform 轮询读 computed style（profile 页面唯一，页内单匹配直取）。
  const readProfileStyle = () => browser.evaluate(() => {
    const profiles = document.querySelectorAll(".curation-home__profile");
    if (profiles.length !== 1) throw new Error(`expected exactly one profile, found ${profiles.length}`);
    const style = getComputedStyle(profiles[0]);
    return { top: style.top, transform: style.transform };
  });

  for (const top of [81, 90, 105, 600, 90, 40, 16]) {
    await scrollTo(top);
    await expect(profile).toHaveAttribute("data-mobile-collapsed", "");
    await expect.poll(readProfileStyle).toEqual({ top: `-${offset}px`, transform: "none" });
    await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-Math.min(top, offset));
    expect((await profile.boundingBox())!.height).toBe(expanded.height);
    if (top === 600) {
      expect(Math.abs((await navigation.boundingBox())!.y)).toBeLessThan(1);
      const toolbar = (await browser.locator(".stream-date-toolbar").boundingBox())!;
      expect(Math.abs(toolbar.y - (await navigation.boundingBox())!.height)).toBeLessThan(1);
    }
  }

  await scrollTo(15);
  await expect(profile).not.toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(0);
  await scrollTo(600);
  await expect(profile).toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-offset);
  // 旧 profile.getByRole("link", { name: "GitHub", exact: true }).evaluate(focus)：页内按同一
  // 作用域与精确名取唯一链接（可访问名即其文本），preventScroll 防滚动干扰收缩态。
  await browser.evaluate(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".curation-home__profile a"))
      .filter((link) => link.textContent?.trim() === "GitHub");
    if (links.length !== 1) throw new Error(`expected exactly one GitHub link in profile, found ${links.length}`);
    links[0].focus({ preventScroll: true });
    return null;
  });
  await expect(profile).not.toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(0);
  await browser.evaluate(() => {
    (document.activeElement as HTMLElement).blur();
    window.scrollTo({ behavior: "instant", top: 0 });
    return null;
  });
  // 旧版末段的 emulateMedia reduce 与 transition-duration 0s 断言依赖 CSS @media（引擎无法
  // 模拟），留在 layout-input-regressions.spec.ts；此处滚动往返只断言最终位置，经 240ms
  // 过渡到达同一终态。
  await scrollTo(600);
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-offset);
  await scrollTo(0);
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(expanded.y);
});

for (const path of ["/", "/curation"] as const) {
  test(`${path} mobile identity controls expose 44px touch targets`, async ({ app, screen, browser }) => {
    await browser.setViewport({ height: 844, width: 390 });
    await app.open(path);

    const controls = [
      screen.getByRole("button", /切换为.+主题/u),
      screen.getByRole("link", "GitHub"),
      screen.getByRole("link", "语雀"),
      screen.getByRole("button", "关于我"),
    ];

    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
