import { expect, test } from "@playwright/test";

test("about receipt uses Motion and keeps a reduced-motion final state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "关于我" }).click();
  const modal = page.getByRole("dialog", { name: "关于我：个人经历打印稿" });
  const paper = modal.locator(".about-printer__paper");
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await expect.poll(() => paper.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await modal.getByRole("button", { name: "关闭" }).click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "关于我" }).click();
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await page.waitForTimeout(2_200);
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await expect(modal.getByRole("status")).toHaveText("打印完成 · 请取走小票", { timeout: 500 });
  await modal.getByRole("button", { name: "关闭" }).click();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const reducedModal = page.getByRole("dialog", { name: "关于我：个人经历打印稿" });
  await expect.poll(async () => {
    if (await reducedModal.count()) return true;
    await page.getByRole("button", { name: "关于我" }).click();
    return Boolean(await reducedModal.count());
  }).toBe(true);
  await expect(reducedModal.getByRole("status")).toHaveText("打印完成 · 请取走小票");
  expect(await reducedModal.locator(".lucide-loader-circle").count()).toBe(0);
  expect(await reducedModal.locator(".about-printer__paper").evaluate((element) => (
    getComputedStyle(element).transform
  ))).toBe("none");
  await reducedModal.getByRole("button", { name: "关闭" }).click();
});

test("mobile profile bridge uses Motion and clears transition state", async ({ page }) => {
  const instrumentProfileMotion = () => page.evaluate(() => {
    const testWindow = window as typeof window & { __profileRevealDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__profileRevealDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (keyframes && typeof keyframes === "object" && "opacity" in keyframes) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__profileRevealDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });
  const readProfileState = () => page.evaluate(() => ({
    bridging: document.querySelector<HTMLElement>(".curation-home__profile")?.dataset.profileBridging,
    feedHold: document.documentElement.dataset.profileFeedHold,
    ghosts: document.querySelectorAll(".profile-transition-ghost").length,
    profileTransition: document.documentElement.dataset.profileTransition,
    revealDurations: (
      window as typeof window & { __profileRevealDurations?: number[] }
    ).__profileRevealDurations ?? [],
  }));

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await instrumentProfileMotion();
  await page.getByRole("link", { name: "开源关注" }).click();
  await expect(page).toHaveURL(/\/open-source$/u);
  await expect.poll(async () => (await readProfileState()).ghosts).toBe(0);
  const collapsed = await readProfileState();
  expect(collapsed.revealDurations.filter((duration) => duration === 120).length).toBeGreaterThan(0);
  expect(collapsed).toMatchObject({ bridging: undefined, feedHold: undefined, profileTransition: undefined });

  await page.evaluate(() => {
    (window as typeof window & { __profileRevealDurations: number[] }).__profileRevealDurations = [];
  });
  await page.getByRole("link", { name: "首页" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect.poll(async () => (await readProfileState()).ghosts).toBe(0);
  const expanded = await readProfileState();
  expect(expanded.revealDurations.filter((duration) => duration === 120).length).toBeGreaterThan(0);
  expect(expanded).toMatchObject({ bridging: undefined, feedHold: undefined, profileTransition: undefined });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await instrumentProfileMotion();
  await expect.poll(async () => {
    if (/\/open-source$/u.test(page.url())) return true;
    await page.getByRole("link", { name: "开源关注" }).click();
    return /\/open-source$/u.test(page.url());
  }).toBe(true);
  const reduced = await readProfileState();
  expect(reduced.revealDurations).toEqual([]);
  expect(reduced).toMatchObject({ bridging: undefined, feedHold: undefined, ghosts: 0, profileTransition: undefined });
});

test("mobile navigation shows destination content when profile storage writes fail", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __profileStorageWriteFailures: number };
    testWindow.__profileStorageWriteFailures = 0;
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (this === window.sessionStorage && key === "site-profile-transition") {
        testWindow.__profileStorageWriteFailures += 1;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });

  await page.goto("/");
  await page.getByRole("link", { name: "开源关注" }).click();

  await expect(page).toHaveURL(/\/open-source$/u);
  await expect(page.getByRole("region", { name: "已判读的开源项目" })).toBeVisible();
  await expect(page.locator(".curation-home__profile-header")).toHaveCSS("opacity", "1");
  await expect(page.locator(".profile-transition-ghost")).toHaveCount(0);
  expect(await page.evaluate(() => ({
    failures: (window as typeof window & { __profileStorageWriteFailures: number }).__profileStorageWriteFailures,
    feedHold: document.documentElement.dataset.profileFeedHold,
    profileTransition: document.documentElement.dataset.profileTransition,
  }))).toEqual({ failures: 1, feedHold: undefined, profileTransition: undefined });
  expect(pageErrors).toEqual([]);
});

test("technical signal motion pauses while offscreen", async ({ page }) => {
  await page.setViewportSize({ height: 250, width: 390 });
  await page.goto("/");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await expect(page.locator(".curation-home__stream-skeleton")).toHaveCount(0);
  const field = page.locator(".interactive-dot-field:visible");
  const track = field.locator(".interactive-dot-field__track").first();
  await field.scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("running");

  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("paused");

  await field.scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("running");
});
