import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

// 框架没有 waitForTimeout：Node 侧纯延时与旧 API 同源，供打印时序窗口断言使用。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("about receipt uses Motion and keeps a reduced-motion final state", async ({ app, screen, browser }) => {
  await app.open("/");
  await screen.getByRole("button", "关于我", { exact: false }).click();
  const modal = screen.getByRole("dialog", "关于我：个人经历打印稿", { exact: false });
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  // 旧 modal.locator(".about-printer__paper") 为弹窗作用域单匹配；页内按 role+aria-label 同作用域直取。
  const readPaperTransform = () => browser.evaluate(() => {
    const papers = document.querySelectorAll('[role="dialog"][aria-label="关于我：个人经历打印稿"] .about-printer__paper');
    if (papers.length !== 1) throw new Error(`expected exactly one printer paper, found ${papers.length}`);
    return getComputedStyle(papers[0]).transform;
  });
  await expect.poll(readPaperTransform).not.toBe("none");
  await modal.getByRole("button", "关闭", { exact: false }).click();
  await expect(modal).toBeHidden();
  expect(await browser.evaluate(() => document.body.style.overflow)).toBe("");

  await settle(300);
  await screen.getByRole("button", "关于我", { exact: false }).click();
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await settle(2_200);
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await expect(modal.getByRole("status")).toHaveText("打印完成 · 请取走小票", { timeout: 500 });
  await modal.getByRole("button", "关闭", { exact: false }).click();

  await emulateReducedMotion(browser);
  await browser.reload();
  const reducedModal = screen.getByRole("dialog", "关于我：个人经历打印稿", { exact: false });
  await expect.poll(async () => {
    if (await reducedModal.count()) return true;
    await screen.getByRole("button", "关于我", { exact: false }).click();
    return Boolean(await reducedModal.count());
  }).toBe(true);
  await expect(reducedModal.getByRole("status")).toHaveText("打印完成 · 请取走小票");
  expect(await browser.locator('[role="dialog"][aria-label="关于我：个人经历打印稿"] .lucide-loader-circle').count()).toBe(0);
  expect(await readPaperTransform()).toBe("none");
  await reducedModal.getByRole("button", "关闭", { exact: false }).click();
});

test("mobile profile bridge uses Motion and clears transition state", async ({ app, screen, browser }) => {
  const instrumentProfileMotion = () => browser.evaluate(() => {
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
    return null;
  });
  // evaluate 返回必须 JSON：dataset 三处现读的 undefined 落回 null 哨兵，断言同步用 null。
  const readProfileState = () => browser.evaluate(() => ({
    bridging: document.querySelector<HTMLElement>(".curation-home__profile")?.dataset.profileBridging ?? null,
    feedHold: document.documentElement.dataset.profileFeedHold ?? null,
    ghosts: document.querySelectorAll(".profile-transition-ghost").length,
    profileTransition: document.documentElement.dataset.profileTransition ?? null,
    revealDurations: (
      window as typeof window & { __profileRevealDurations?: number[] }
    ).__profileRevealDurations ?? [],
  }));

  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/");
  await instrumentProfileMotion();
  await screen.getByRole("link", "开源关注", { exact: false }).click();
  await expect(browser).toHaveURL(/\/open-source$/u);
  await expect.poll(async () => (await readProfileState()).ghosts).toBe(0);
  const collapsed = await readProfileState();
  expect(collapsed.revealDurations.filter((duration) => duration === 120).length).toBeGreaterThan(0);
  expect(collapsed).toMatchObject({ bridging: null, feedHold: null, profileTransition: null });

  await browser.evaluate(() => {
    (window as typeof window & { __profileRevealDurations: number[] }).__profileRevealDurations = [];
    return null;
  });
  await screen.getByRole("link", "首页", { exact: false }).click();
  await expect(browser).toHaveURL(/\/$/u);
  await expect.poll(async () => (await readProfileState()).ghosts).toBe(0);
  const expanded = await readProfileState();
  expect(expanded.revealDurations.filter((duration) => duration === 120).length).toBeGreaterThan(0);
  expect(expanded).toMatchObject({ bridging: null, feedHold: null, profileTransition: null });

  await emulateReducedMotion(browser);
  await browser.reload();
  await instrumentProfileMotion();
  await expect.poll(async () => {
    if (/\/open-source$/u.test(await browser.url())) return true;
    await screen.getByRole("link", "开源关注", { exact: false }).click();
    return /\/open-source$/u.test(await browser.url());
  }).toBe(true);
  const reduced = await readProfileState();
  expect(reduced.revealDurations).toEqual([]);
  expect(reduced).toMatchObject({ bridging: null, feedHold: null, ghosts: 0, profileTransition: null });
});

test("mobile navigation shows destination content when profile storage writes fail", async ({ app, screen, browser }) => {
  // 框架无 page.on("pageerror")：init script 在页面记录未捕获 error 与 unhandledrejection
  // 事件（元素资源错误不冒泡到 window），与 pageerror 同为未捕获异常面。
  await browser.addInitScript(() => {
    const testWindow = window as typeof window & { __pageErrors: string[] };
    testWindow.__pageErrors = [];
    window.addEventListener("error", (event) => testWindow.__pageErrors.push(event.message));
    window.addEventListener("unhandledrejection", (event) => {
      testWindow.__pageErrors.push(String(event.reason?.message ?? event.reason));
    });
  });
  await browser.setViewport({ height: 844, width: 390 });
  // 旧版 emulateMedia no-preference：引擎默认即 no-preference，无需补丁。
  await browser.addInitScript(() => {
    const testWindow = window as typeof window & { __profileStorageWriteFailures: number };
    testWindow.__profileStorageWriteFailures = 0;
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (this === window.sessionStorage && key === "site-profile-transition") {
        testWindow.__profileStorageWriteFailures += 1;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });

  await app.open("/");
  await screen.getByRole("link", "开源关注", { exact: false }).click();

  await expect(browser).toHaveURL(/\/open-source$/u);
  await expect(screen.getByRole("region", "已判读的开源项目", { exact: false })).toBeVisible();
  // 框架无 toHaveCSS：opacity 轮询读 computed style；旧 locator 页面唯一，页内单匹配直取。
  await expect.poll(() => browser.evaluate(() => {
    const headers = document.querySelectorAll(".curation-home__profile-header");
    if (headers.length !== 1) throw new Error(`expected exactly one profile header, found ${headers.length}`);
    return getComputedStyle(headers[0]).opacity;
  })).toBe("1");
  await expect(browser.locator(".profile-transition-ghost")).toHaveCount(0);
  expect(await browser.evaluate(() => ({
    failures: (window as typeof window & { __profileStorageWriteFailures: number }).__profileStorageWriteFailures,
    feedHold: document.documentElement.dataset.profileFeedHold ?? null,
    profileTransition: document.documentElement.dataset.profileTransition ?? null,
  }))).toEqual({ failures: 1, feedHold: null, profileTransition: null });
  expect(await browser.evaluate(() => (
    window as typeof window & { __pageErrors?: string[] }
  ).__pageErrors ?? [])).toEqual([]);
});

test("technical signal motion pauses while offscreen", async ({ app, browser }) => {
  await browser.setViewport({ height: 250, width: 390 });
  await app.open("/");
  // 旧断言经 Playwright 10s 断言预算等完 5s 开机仪式后元素卸载；引擎默认断言预算更短，显式给同额预算。
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 10_000 });
  await expect(browser.locator(".curation-home__stream-skeleton")).toHaveCount(0);
  const field = browser.locator(".interactive-dot-field:visible");
  // 旧 field.locator(".interactive-dot-field__track").first() 不要求唯一：页内取「可见 dot field
  // 的全部 track」的第一个；可见性判定沿用 :visible 语义（有盒且未 hidden），不收紧。
  const readTrackPlayState = () => browser.evaluate(() => {
    const fields = Array.from(document.querySelectorAll<HTMLElement>(".interactive-dot-field"))
      .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    const tracks = fields.flatMap((element) => Array.from(element.querySelectorAll<HTMLElement>(".interactive-dot-field__track")));
    if (tracks.length < 1) throw new Error("no visible dot-field track");
    return tracks[0].getAnimations()[0]?.playState ?? null;
  });
  await field.scrollIntoView();
  await expect.poll(readTrackPlayState).toBe("running");

  await browser.evaluate(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
    return null;
  });
  await expect.poll(readTrackPlayState).toBe("paused");

  await field.scrollIntoView();
  await expect.poll(readTrackPlayState).toBe("running");
});
