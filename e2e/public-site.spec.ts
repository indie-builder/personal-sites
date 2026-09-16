import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openAssistant } from "./helpers/assistant";

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

test("open-source filters cap Motion stagger and honor reduced motion", async ({ page }) => {
  const instrumentListMotion = () => page.evaluate(() => {
    const testWindow = window as typeof window & { __filterMotionDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__filterMotionDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (this instanceof HTMLLIElement && this.closest('[aria-label="已判读的开源项目"]')) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__filterMotionDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });
  const readDurations = () => page.evaluate(() => (
    window as typeof window & { __filterMotionDurations?: number[] }
  ).__filterMotionDurations ?? []);

  await page.goto("/open-source");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await expect.poll(() => page.locator('[aria-label="已判读的开源项目"] ol > li').evaluateAll(rows => rows.every(row => row.getAnimations().length === 0))).toBe(true);
  await instrumentListMotion();
  const skillsFilter = page.getByRole("button", { name: /^Skills 与工作流/u });
  await skillsFilter.click();
  await expect(skillsFilter).toHaveAttribute("aria-pressed", "true");
  const filteredRows = await page.locator('[aria-label="已判读的开源项目"] ol > li').count();
  await expect.poll(readDurations).toEqual(Array(Math.min(filteredRows, 8)).fill(280));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await instrumentListMotion();
  const reducedSkillsFilter = page.getByRole("button", { name: /^Skills 与工作流/u });
  await expect.poll(async () => {
    if (await reducedSkillsFilter.getAttribute("aria-pressed") === "true") return true;
    await reducedSkillsFilter.click();
    return await reducedSkillsFilter.getAttribute("aria-pressed") === "true";
  }).toBe(true);
  expect(await readDurations()).toEqual([]);
  expect(await page.locator('[aria-label="已判读的开源项目"] ol > li').evaluateAll((rows) => (
    rows.every((row) => getComputedStyle(row).opacity === "1")
  ))).toBe(true);
});

test("repository loading uses Motion and keeps a static reduced state", async ({ page }) => {
  let releaseTree = () => {};
  let treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await page.route("**/api/open-source/jakubkrehel-skills/repository/tree", async (route) => {
    await treeGate;
    await route.fulfill({
      json: {
        branch: "main",
        entries: [],
        repository: "jakubkrehel/skills",
        repositoryUrl: "https://github.com/jakubkrehel/skills",
        truncated: false,
      },
    });
  });

  await page.goto("/open-source/jakubkrehel-skills");
  await page.getByRole("tab", { name: "仓库结构" }).click();
  const loading = page.getByText("正在读取原始仓库结构…");
  const icon = loading.locator("svg");
  await expect(loading).toBeVisible();
  expect(await icon.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect.poll(() => icon.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  releaseTree();
  await expect(loading).toBeHidden();

  treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(loading).toBeVisible();
  await expect(icon).toHaveCSS("transform", "none");
  await page.waitForTimeout(300);
  await expect(icon).toHaveCSS("transform", "none");
  releaseTree();
  await expect(loading).toBeHidden();
});

test("Ask retrieval status uses Motion with a static reduced state", async ({ page }) => {
  let releaseResponse!: () => void;
  let responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/ask", async (route) => {
    await responseGate;
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "输入问题" });
  await input.focus();
  await page.waitForLoadState("networkidle");
  await input.fill("测试检索状态");
  await page.getByRole("button", { name: "发送问题" }).click();
  const statusIcon = page.getByRole("status").locator("svg");
  await expect(statusIcon).toBeVisible();
  expect(await statusIcon.evaluate((icon) => getComputedStyle(icon).animationName)).toBe("none");
  releaseResponse();
  await expect(statusIcon).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAssistant(page);
  responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const reducedInput = page.getByRole("textbox", { name: "输入问题" });
  await reducedInput.fill("测试减少动态");
  const reducedSend = page.getByRole("button", { name: "发送问题" });
  await expect(reducedSend).toBeEnabled();
  await reducedSend.click();
  const reducedStatusIcon = page.getByRole("status").locator("svg");
  await expect(reducedStatusIcon).toHaveCSS("opacity", "1");
  await page.waitForTimeout(300);
  await expect(reducedStatusIcon).toHaveCSS("opacity", "1");
  releaseResponse();
});

test("assistant drawer sends without delaying the request", async ({ page }) => {
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "输入问题" });
  await input.focus();
  await page.waitForLoadState("networkidle");
  await input.fill("请概括你的工程实践");

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming: { clickAt: number; fetchAt: number };
    };
    const nativeFetch = window.fetch.bind(window);
    testWindow.__askMotionTiming = { clickAt: 0, fetchAt: 0 };
    window.fetch = (...args) => {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      if (url.includes("/api/ask")) testWindow.__askMotionTiming.fetchAt = performance.now();
      return nativeFetch(...args);
    };
    document.querySelector('button[aria-label="发送问题"]')?.addEventListener("click", () => {
      testWindow.__askMotionTiming.clickAt = performance.now();
    }, { capture: true, once: true });
  });

  await page.getByRole("button", { name: "发送问题" }).click();
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming?: { clickAt: number; fetchAt: number };
    };
    const timing = testWindow.__askMotionTiming;
    return timing?.fetchAt ? timing.fetchAt - timing.clickAt : Infinity;
  })).toBeLessThan(300);
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

test("public discovery endpoints remain machine readable", async ({ request }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
    ["/feed.xml", "application/rss+xml"],
    ["/opengraph-image", "image/png"],
  ] as const) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()["content-type"], path).toContain(type);
  }

  const health = await request.get("/api/health/data");
  expect(health.ok()).toBe(true);
  const healthBody = await health.json();
  expect(healthBody).toMatchObject({
    askIndex: { healthy: true, missingFts: 0, orphanFts: 0 },
    database: { healthy: true, quickCheck: "ok" },
  });
  expect(healthBody.aiNews).not.toHaveProperty("lastError");
});

test("Ask has no automatically detectable accessibility violations", async ({ page }) => {
  await openAssistant(page);
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations).toEqual([]);
});
