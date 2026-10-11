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

// 头像粒子的契约：粒子接管后静态点描只在 ghost 克隆兜底；reduce 下（含
// 会话中途开启）点击直接落到静止伙伴帧/头像；会话中途开启 reduce 把已选中
// 的伙伴定格为静止帧并保留选择，关闭后只续播指针选中的循环；触屏点按播放
// 伙伴踏步循环。e2e 运行器无 emulateMedia 与 hasTouch 设备仿真，留 Playwright
//（会话中途切换依赖 emulateMedia 派发的 change 事件，运行器的 matchMedia 补丁做不到）。
const skipOpeningLoader = (page: Page) => page.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

// 成像态脸占据中心：中心 40% 方框的墨点像素占比。
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

const readCanvasDataUrl = (page: Page) => page.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  return canvas ? canvas.toDataURL() : null;
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

test("avatar rests on the portrait and a click shows the still mascot under reduced motion", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });
  await expect(avatar).toHaveAttribute("aria-label", "将陈远的点描头像变成像素小伙伴");
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  await expect(avatar).toHaveAttribute("data-avatar-shape", "portrait");
  // 无进站飞行：武装后首次读取即成像终态。
  expect(await readCenterDensity(page)).toBeGreaterThan(0.03);

  await avatar.click();
  // reduce 下点击直接落到静止伙伴帧，不播动画。
  await expect(avatar).toHaveAttribute("aria-label", "回到陈远的点描头像");
  await expect(avatar).toHaveAttribute("data-avatar-state", "static");
  await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
  const still = await readCanvasDataUrl(page);
  await page.waitForTimeout(300);
  expect(await readCanvasDataUrl(page)).toBe(still);

  // 再点回到头像成像终态。
  await avatar.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 2_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "portrait");
  expect(await readCenterDensity(page)).toBeGreaterThan(0.03);
});

for (const disableWhileHidden of [false, true]) {
  test(`a mascot selected by pointer under reduced motion resumes when the preference is disabled${disableWhileHidden ? " while hidden" : ""}`, async ({ page }) => {
    await skipOpeningLoader(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/curation");
    const avatar = page.locator(".curation-home__avatar");
    await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });
    const portrait = await readCanvasDataUrl(page);
    await avatar.click();
    await expect(avatar).toHaveAttribute("data-avatar-state", "static");
    await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
    const still = await readCanvasDataUrl(page);
    expect(still).not.toBe(portrait);

    if (disableWhileHidden) {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    if (disableWhileHidden) {
      await page.waitForTimeout(600);
      expect(await readCanvasDataUrl(page)).toBe(still);
      await page.evaluate(() => {
        Reflect.deleteProperty(document, "hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    await expect(avatar).toHaveAttribute("data-avatar-state", "mascot");
    await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
    await expect.poll(async () => {
      const first = await readCanvasDataUrl(page);
      await page.waitForTimeout(250);
      return first !== (await readCanvasDataUrl(page));
    }).toBe(true);

    await avatar.click();
    await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
    expect(await readCanvasDataUrl(page)).toBe(portrait);
  });
}

test("reduced motion landing mid-mascot freezes the still frame and turning it off resumes the loop", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

  await avatar.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "mascot", { timeout: 3_000 });
  // 踏步中开启 reduce：定格为静止伙伴帧，选择保留，无残留计时。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(avatar).toHaveAttribute("data-avatar-state", "static", { timeout: 2_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
  const still = await readCanvasDataUrl(page);
  await page.waitForTimeout(300);
  expect(await readCanvasDataUrl(page)).toBe(still);

  // 关闭 reduce：指针选中的伙伴续播循环，画面重新动起来。
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(avatar).toHaveAttribute("data-avatar-state", "mascot", { timeout: 2_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
  await expect.poll(async () => {
    const first = await readCanvasDataUrl(page);
    await page.waitForTimeout(250);
    return first !== (await readCanvasDataUrl(page));
  }, { timeout: 5_000 }).toBe(true);

  await avatar.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 5_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "portrait");
});

test("a keyboard-still mascot stays still across a reduced-motion round trip", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

  // 键盘路径定格静止伙伴帧。
  await avatar.focus();
  await page.keyboard.press("Enter");
  await expect(avatar).toHaveAttribute("data-avatar-state", "static", { timeout: 2_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "mascot");
  const still = await readCanvasDataUrl(page);

  // 开启再关闭 reduce：键盘定格的选择不续播循环，画面保持静止帧。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => readCanvasDataUrl(page), { timeout: 2_000 }).toBe(still);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(600);
  await expect(avatar).toHaveAttribute("data-avatar-state", "static");
  expect(await readCanvasDataUrl(page)).toBe(still);

  await page.keyboard.press("Enter");
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 2_000 });
  expect(await readCenterDensity(page)).toBeGreaterThan(0.03);
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

test("the mascot walk freezes while hidden and resumes the loop after the pause", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const avatar = page.locator(".curation-home__avatar");
  await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

  await avatar.click();
  // 页内探针：踏步中的当帧隐藏页面，1.5s 后恢复；测量隐藏期画面是否冻结。
  // 运行器侧同契约（含恢复后续走与显式返回）在 avatar-mascot.e2e.ts。
  await page.evaluate(() => {
    const w = window as typeof window & { __freezeProbe?: { done: boolean; frozenWhileHidden: boolean } };
    w.__freezeProbe = { done: false, frozenWhileHidden: false };
    const button = document.querySelector<HTMLElement>(".curation-home__avatar");
    const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
    if (!button || !canvas) return;
    const tick = () => {
      if (w.__freezeProbe?.done) return;
      if (button.dataset.avatarState === "mascot") {
        const atHide = canvas.toDataURL();
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.setTimeout(() => {
          w.__freezeProbe!.frozenWhileHidden = canvas.toDataURL() === atHide;
          Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
          document.dispatchEvent(new Event("visibilitychange"));
          w.__freezeProbe!.done = true;
        }, 1_500);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __freezeProbe?: { done: boolean } }).__freezeProbe?.done ?? false), { timeout: 25_000 }).toBe(true);
  // 隐藏期间定格画面不推进；恢复后循环续走（画面重新变化）。
  const probe = await page.evaluate(() => (window as typeof window & { __freezeProbe?: { frozenWhileHidden: boolean } }).__freezeProbe);
  expect(probe?.frozenWhileHidden).toBe(true);
  await expect.poll(async () => {
    const first = await readCanvasDataUrl(page);
    await page.waitForTimeout(250);
    return first !== (await readCanvasDataUrl(page));
  }, { timeout: 5_000 }).toBe(true);
  // 仍是选中的伙伴，直到显式点击才回头像。
  await expect(avatar).toHaveAttribute("data-avatar-state", "mascot");
  await avatar.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 5_000 });
  await expect(avatar).toHaveAttribute("data-avatar-shape", "portrait");
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

// 技术词条底纹水波的同面契约：画布接管后收起 CSS 静态点阵；会话中途开启
// reduce 立即回退 CSS 静态（画布清空，无双格叠加），关闭 reduce 重新接管且不自动起波。
test("dot field ripples step down to the static gradient under reduced motion and re-arm without waves", async ({ page }) => {
  await skipOpeningLoader(page);
  await page.goto("/curation");
  const field = page.locator(".interactive-dot-field");
  const canvas = field.locator("canvas");
  await expect(field).toHaveAttribute("data-dot-ripples", "ready", { timeout: 10_000 });
  await expect(field).toHaveCSS("background-image", "none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(field).not.toHaveAttribute("data-dot-ripples", "ready");
  await expect(field).not.toHaveCSS("background-image", "none");
  await expect(canvas).not.toHaveAttribute("data-rippling", "true");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(field).toHaveAttribute("data-dot-ripples", "ready", { timeout: 5_000 });
  await expect(canvas).not.toHaveAttribute("data-rippling", "true");
});

test.describe("touch media", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  test("tapping the avatar starts the mascot walk and a second tap returns to the portrait", async ({ page }) => {
    await skipOpeningLoader(page);
    await page.goto("/curation");
    expect(await page.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches)).toBe(true);
    const avatar = page.locator(".curation-home__avatar");
    await expect(avatar).toHaveAttribute("data-particles", "on", { timeout: 10_000 });

    // 触屏点按是普通指针输入：播放持续踏步的伙伴循环而不是瞬时定格。
    await avatar.tap();
    await expect(avatar).toHaveAttribute("data-avatar-state", "mascot", { timeout: 3_000 });
    await expect(avatar).toHaveAttribute("aria-label", "回到陈远的点描头像");
    // 点按不恢复静态点描，粒子态持续接管。
    await expect(page.locator(".curation-home__avatar-stipple")).toHaveCSS("opacity", "0");

    // 再点：取消循环并回到头像。
    await avatar.tap();
    await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 6_000 });
    await expect(avatar).toHaveAttribute("data-avatar-shape", "portrait");
  });
});
