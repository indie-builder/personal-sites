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

// 头像粒子的契约：粒子接管后静态点描只在 ghost 克隆兜底、reduce 下（含会话中途
// 开启）瞬时落到终态、触屏点按切换聚散。e2e 运行器无 emulateMedia 与 hasTouch
// 设备仿真，留 Playwright。
const skipOpeningLoader = (page: Page) => page.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

// 成像态脸占据中心，散开态中心清空：中心 40% 方框的墨点像素占比。
const readCenterDensity = (page: Page) => page.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!canvas) throw new Error("avatar canvas missing");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("avatar canvas context missing");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) ink += 1;
      total += 1;
    }
  }
  return ink / total;
});

test("avatar particle canvas takes over and the ghost clone keeps the static stipple", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });
  await expect(page.locator(".curation-home__avatar-stipple")).toHaveCSS("opacity", "0");

  // 移动端飞行 ghost 是画布克隆（无位图），静态点描必须在 ghost 里保持可见兜底。
  const ghostOpacity = await page.evaluate(() => {
    const source = document.querySelector(".curation-home__avatar")!;
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.classList.add("profile-transition-ghost");
    document.body.append(ghost);
    const stipple = ghost.querySelector(".curation-home__avatar-stipple")!;
    const opacity = getComputedStyle(stipple).opacity;
    ghost.remove();
    return opacity;
  });
  expect(ghostOpacity).toBe("1");
});

test("avatar assembles instantly when reduced motion is on from the start", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });
  await expect(avatar).toHaveAttribute("aria-label", "分散陈远的点描头像");
  // 无进站飞行：武装后首次读取即成像终态。
  expect(await readCenterDensity(page)).toBeGreaterThan(0.03);

  await avatar.click();
  await expect(avatar).toHaveAttribute("aria-label", "聚拢陈远的点描头像");
  expect(await readCenterDensity(page)).toBeLessThan(0.005);
});

test("avatar animation lands on its current target when reduced motion turns on mid-flight", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

  await avatar.click();
  // 散开飞行（720ms+110ms stagger）未完时开启 reduce：必须立即落到散开终态并静止。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => readCenterDensity(page), { timeout: 1_000 }).toBeLessThan(0.005);
  await page.waitForTimeout(300);
  expect(await readCenterDensity(page)).toBeLessThan(0.005);
});

test("name intro collapses straight to the avatar when reduced motion turns on mid-spell", async ({ page }) => {
  // 首访完整仪式（Playwright 每用例全新 context 即全新会话），名字序列开演后
  // 开启 reduce：序列取消，直接停在头像成像终态，而不是定格在半成的字。
  await page.goto("/curation");
  await expect(page.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });
  // 首字成形：中心成墨但密度远低于成像脸的实心墨。
  await expect.poll(() => readCenterDensity(page), { timeout: 15_000 }).toBeGreaterThan(0.03);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => readCenterDensity(page), { timeout: 1_000 }).toBeGreaterThan(0.35);
  await page.waitForTimeout(400);
  expect(await readCenterDensity(page)).toBeGreaterThan(0.35);
});

test("avatar animation freezes while hidden and resumes on visibility return", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

  await avatar.click();
  // 散开飞行中途页面隐藏：暂停时长折算后动画冻结，不再推进到终态。
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1_500);
  const frozen = await readCenterDensity(page);
  expect(frozen).toBeGreaterThan(0.005);

  // 回到可见：从暂停处续播并到达散开终态，而不是永久冻结。
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => readCenterDensity(page), { timeout: 3_000 }).toBeLessThan(0.005);
});

test("avatar keeps the static stipple when the canvas context is unavailable", async ({ page }) => {
  await skipOpeningLoader(page);
  // 只让挂进 DOM 的展示画布拿不到 2d 上下文；离线采样画布不受影响。
  await page.addInitScript(`
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
      if (this.isConnected) return null;
      return native.call(this, type, options);
    };
  `);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  // 采样照常完成，但首绘失败：粒子不接管，静态点描保持可见兜底。
  await page.waitForTimeout(2_000);
  await expect(avatar).toHaveAttribute("data-particles", "off");
  await expect(page.locator(".curation-home__avatar-stipple")).toHaveCSS("opacity", "1");
  await expect(avatar).toBeVisible();
});

test.describe("touch media", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  test("tapping the avatar toggles scatter and never reveals the static face", async ({ page }) => {
    await skipOpeningLoader(page);
    await page.goto("/curation");
    expect(await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches)).toBe(true);
    const avatar = page.locator(".curation-home__avatar");
    await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

    await avatar.tap();
    await expect(avatar).toHaveAttribute("aria-label", "聚拢陈远的点描头像");
    // 点按不恢复静态点描，粒子态持续接管。
    await expect(page.locator(".curation-home__avatar-stipple")).toHaveCSS("opacity", "0");

    await avatar.tap();
    await expect(avatar).toHaveAttribute("aria-label", "分散陈远的点描头像");
  });
});
