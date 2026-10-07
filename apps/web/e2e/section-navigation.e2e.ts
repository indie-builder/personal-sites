import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotionNow } from "./helpers/reduced-motion.ts";

test("frequent section navigation is immediate and leaves content visible", async ({ app, screen, browser }) => {
  await app.open("/curation");
  await browser.evaluate(() => {
    const testWindow = window as typeof window & { __sectionMotionDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__sectionMotionDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (this instanceof HTMLElement && this.classList.contains("site-section-motion")) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__sectionMotionDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
    return null;
  });

  await screen.getByRole("link", "设计收藏", { exact: false }).tap();
  await expect(browser).toHaveURL(/\/design$/u);
  await expect.poll(() => browser.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([]);
  await expect.poll(() => browser.evaluate((selector) => {
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) throw new Error(`expected exactly one ${selector}, found ${matches.length}`);
    const element = matches[0] as HTMLElement;
    return { opacity: element.style.opacity, transform: element.style.transform };
  }, ".site-section-motion")).toEqual({ opacity: "", transform: "" });

  await emulateReducedMotionNow(browser);
  await browser.evaluate(() => {
    (window as typeof window & { __sectionMotionDurations: number[] }).__sectionMotionDurations = [];
    return null;
  });
  await screen.getByRole("link", "每日关注", { exact: false }).tap();
  await expect(browser).toHaveURL(/\/curation$/u);
  expect(await browser.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([]);
});

test("mobile section navigation stays readable and reveals the current section", async ({ app, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/open-source");

  const navigation = browser.locator('nav[aria-label="内容导航"]:visible');
  const current = navigation.getByRole("link", "开源关注", { exact: false });

  await expect(current).toHaveAttribute("aria-current", "page");
  // 框架没有 toBeInViewport：以 boundingBox（视口相对）与视口尺寸的相交判定等价复现。
  await expect.poll(async () => {
    const box = await current.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const viewport = await browser.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    return box.x < viewport.width && box.x + box.width > 0 && box.y < viewport.height && box.y + box.height > 0;
  }).toBe(true);
  // 框架没有 locator.evaluateAll：在页面内等价复现「可见导航内全部链接」的遍历。
  const linksReadable = await browser.evaluate(() => {
    const navs = Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="内容导航"]'))
      .filter((nav) => nav.getClientRects().length > 0 && getComputedStyle(nav).visibility !== "hidden");
    return navs.flatMap((nav) => Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[href]")))
      .every((element) => {
        const style = getComputedStyle(element);
        return style.whiteSpace === "nowrap" && element.getBoundingClientRect().height >= 44;
      });
  });
  expect(linksReadable).toBe(true);
});
