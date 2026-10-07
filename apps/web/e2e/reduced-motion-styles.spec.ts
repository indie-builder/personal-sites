import { expect, test, type Page } from "@playwright/test";

// 留守件（与 curation-detail-responsive.spec.ts 同类）：两条用例断言的均是
// prefers-reduced-motion CSS @media 规则生效后的计算样式（降级声明源顺序的回归）。
// e2e 运行器（@e2e-dev/web）没有 emulateMedia，引擎也不模拟该媒体特性；matchMedia
// 补丁只影响 JS 现读，改不了 CSS 级联，这些断言无法等价表达。

// 降级规则的源顺序回归：reduce 覆盖必须排在同特异性的正常声明之后，
// 这里断言的是真实页面样式表里的计算样式，而不是 CSS 文本。
test("stream error fade is neutralized under reduced motion and intact otherwise", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const readComputed = () => page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "curation-home__stream-error";
    document.body.append(probe);
    const { transitionDuration, transitionProperty } = getComputedStyle(probe);
    probe.remove();
    return { transitionDuration, transitionProperty };
  });
  await expect.poll(readComputed).toEqual({ transitionDuration: "0s", transitionProperty: "none" });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(readComputed).toEqual({ transitionDuration: "0.2s", transitionProperty: "opacity" });
});

test("repository panel transitions are neutralized under reduced motion once data arms the entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/open-source/herdr/repository/tree", (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "herdrdev/herdr",
      repositoryUrl: "https://github.com/herdrdev/herdr",
      truncated: false,
    },
  }));
  await page.goto("/open-source/herdr");
  await page.getByRole("tab", { name: "仓库结构" }).click();
  const treePane = page.locator('[aria-label="原始仓库文件树"]');
  await expect(treePane).toBeVisible();
  const browserContent = treePane.locator("xpath=..");
  const browserRoot = browserContent.locator("xpath=..");
  // 入场武装（data-entrance）在新数据提交时落下；reduce 下五处 180ms 淡入的计算样式仍必须是 none。
  await expect(browserRoot).toHaveAttribute("data-entrance", "");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  const fileEmpty = page.getByText("从左侧文件树选择一个文本文件查看原始内容。");
  await expect.poll(() => fileEmpty.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
});

// 头像点描层的三条契约：桌面 fine-pointer hover 淡出/移开恢复、reduce 瞬时切换、
// 触屏设备不进入 hover 态保持点描。e2e 运行器无 emulateMedia 与 hasTouch 设备仿真，留 Playwright。
const skipOpeningLoader = (page: Page) => page.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

test("avatar stipple fades out on fine-pointer hover and restores on leave", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const stipple = page.locator(".curation-home__avatar-stipple");
  await expect(stipple).toHaveCSS("opacity", "1");
  await expect.poll(() => stipple.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.18s");

  await page.locator(".curation-home__avatar").hover();
  await expect(stipple).toHaveCSS("opacity", "0");

  await page.mouse.move(0, 0);
  await expect(stipple).toHaveCSS("opacity", "1");
});

test("avatar stipple switches instantly under reduced motion and keeps its fade otherwise", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const stipple = page.locator(".curation-home__avatar-stipple");
  await expect.poll(() => stipple.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
  await expect.poll(() => stipple.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");

  await page.locator(".curation-home__avatar").hover();
  await expect(stipple).toHaveCSS("opacity", "0");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => stipple.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.18s");
});

test.describe("touch media", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  test("tapping the avatar keeps the stipple layer fully opaque", async ({ page }) => {
    await skipOpeningLoader(page);
    await page.goto("/curation");
    expect(await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches)).toBe(true);
    const avatar = page.locator(".curation-home__avatar");
    await expect(avatar).not.toHaveAttribute("tabindex");
    await avatar.tap();
    await expect(page.locator(".curation-home__avatar-stipple")).toHaveCSS("opacity", "1");
  });
});
