import { expect, test, type Page } from "./helpers/loader-key";

async function expectNativeDocumentScroll(page: Page, key: "ArrowDown" | "PageDown" | "Space") {
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test("desktop list pages keep native BODY keyboard scrolling", async ({ page }) => {
  await page.setViewportSize({ height: 640, width: 1_440 });
  await page.goto("/design");

  await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeGreaterThan(640);
  for (const key of ["PageDown", "Space", "ArrowDown"] as const) {
    await expectNativeDocumentScroll(page, key);
  }

  await page.goto("/curation");
  await expect(page.locator(".curation-home__feed")).toHaveCSS("overflow-y", "visible");
  await expectNativeDocumentScroll(page, "PageDown");
});

test("mobile profile collapse preserves sticky clamping and scroll hysteresis", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/curation");
  const profile = page.locator(".curation-home__profile");
  const navigation = profile.locator("[data-mobile-navigation]");
  const expanded = (await profile.boundingBox())!;
  const offset = await navigation.evaluate((element) => (element as HTMLElement).offsetTop);
  expect(offset).toBeGreaterThan(105);

  for (const top of [81, 90, 105, 600, 90, 40, 16]) {
    await page.evaluate((y) => window.scrollTo({ behavior: "instant", top: y }), top);
    await expect(profile).toHaveAttribute("data-mobile-collapsed", "");
    await expect(profile).toHaveCSS("top", `-${offset}px`);
    await expect(profile).toHaveCSS("transform", "none");
    await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-Math.min(top, offset));
    expect((await profile.boundingBox())!.height).toBe(expanded.height);
    if (top === 600) {
      expect(Math.abs((await navigation.boundingBox())!.y)).toBeLessThan(1);
      const toolbar = (await page.locator(".stream-date-toolbar").boundingBox())!;
      expect(Math.abs(toolbar.y - (await navigation.boundingBox())!.height)).toBeLessThan(1);
    }
  }

  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 15 }));
  await expect(profile).not.toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(0);
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 600 }));
  await expect(profile).toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-offset);
  await profile.getByRole("link", { name: "GitHub", exact: true }).evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await expect(profile).not.toHaveAttribute("data-mobile-collapsed", "");
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement).blur();
    window.scrollTo({ behavior: "instant", top: 0 });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(profile).toHaveCSS("transition-duration", "0s");
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 600 }));
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(-offset);
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(async () => (await profile.boundingBox())!.y).toBe(expanded.y);
});

for (const path of ["/", "/curation"] as const) {
  test(`${path} mobile identity controls expose 44px touch targets`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(path);

    const controls = [
      page.getByRole("button", { name: /切换为.+主题/u }),
      page.getByRole("link", { name: "GitHub", exact: true }),
      page.getByRole("link", { name: "语雀", exact: true }),
      page.getByRole("button", { name: "关于我", exact: true }),
    ];

    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
