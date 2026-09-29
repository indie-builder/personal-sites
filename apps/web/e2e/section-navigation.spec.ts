import { expect, test } from "@playwright/test";

test("frequent section navigation is immediate and leaves content visible", async ({ page }) => {
  await page.goto("/curation");
  await page.evaluate(() => {
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
  });

  await page.getByRole("link", { name: "设计收藏" }).click();
  await expect(page).toHaveURL(/\/design$/u);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([]);
  await expect.poll(() => page.locator(".site-section-motion").evaluate((element) => ({
    opacity: (element as HTMLElement).style.opacity,
    transform: (element as HTMLElement).style.transform,
  }))).toEqual({ opacity: "", transform: "" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    (window as typeof window & { __sectionMotionDurations: number[] }).__sectionMotionDurations = [];
  });
  await page.getByRole("link", { name: "每日关注" }).click();
  await expect(page).toHaveURL(/\/curation$/u);
  expect(await page.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([]);
});

test("mobile section navigation stays readable and reveals the current section", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/open-source");

  const navigation = page.locator('nav[aria-label="内容导航"]:visible');
  const links = navigation.getByRole("link");
  const current = navigation.getByRole("link", { name: "开源关注" });

  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toBeInViewport();
  expect(await links.evaluateAll((elements) => elements.every((element) => {
    const style = getComputedStyle(element);
    return style.whiteSpace === "nowrap" && element.getBoundingClientRect().height >= 44;
  }))).toBe(true);
});
