import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { readAvatarMeta, readCanvasDigest } from "./helpers/avatar.ts";

// 头像粒子彩蛋的行为契约：会话已播过开屏仪式时进站直接停在成像头像；
// 点击在头像与像素小伙伴之间切换——指针点击飞成伙伴并持续原地踏步，
// 再次点击从当前位置回到头像；键盘/减少动态点击直接呈现静止伙伴帧；
// 墨色随主题、移动端飞行 ghost 靠静态点描兜底。首访的名字序列契约在
// avatar-name-intro.e2e.ts，伙伴持续踏步与快速反转在 avatar-mascot.e2e.ts。
// 断言读画布真实像素与可访问名称，不镜像实现细节。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const ASSEMBLED_CENTER_MIN = 0.03;

// 中心 40% 方框与四周 18% 边带的墨点像素占比；armed 为粒子是否接管。
const readAvatarField = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const button = document.querySelector<HTMLElement>(".curation-home__avatar");
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!button || !canvas) throw new Error("avatar button or canvas missing");
  const armed = button.dataset.particles === "on";
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0) return { armed, center: 0, edge: 0 };
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let centerInk = 0;
  let centerTotal = 0;
  let edgeInk = 0;
  let edgeTotal = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inCenter = x >= x0 && x < x1 && y >= y0 && y < y1;
      const inEdge = x < width * 0.18 || x >= width * 0.82 || y < height * 0.18 || y >= height * 0.82;
      if (!inCenter && !inEdge) continue;
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (inCenter) centerInk += 1;
        if (inEdge) edgeInk += 1;
      }
      if (inCenter) centerTotal += 1;
      if (inEdge) edgeTotal += 1;
    }
  }
  return {
    armed,
    center: centerInk / centerTotal,
    edge: edgeInk / edgeTotal,
  };
});

const readStippleOpacity = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const stipple = document.querySelector(".curation-home__avatar-stipple");
  return stipple ? getComputedStyle(stipple).opacity : null;
});

// 墨点像素的平均亮度：浅色主题近黑墨、深色主题近白墨。
const readInkBrightness = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!canvas) throw new Error("avatar canvas missing");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("avatar canvas context missing");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 60) continue;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    count += 1;
  }
  return count === 0 ? null : sum / count;
});

const skipOpeningLoader = (browser: import("@e2e-dev/web").Browser) =>
  browser.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

test("avatar settles into the portrait and one click toggles into the stepping mascot", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    (window as typeof window & { __avatarErrors: string[] }).__avatarErrors = [];
    window.addEventListener("error", (event) => (window as typeof window & { __avatarErrors: string[] }).__avatarErrors.push(event.message));
    window.addEventListener("unhandledrejection", (event) => {
      (window as typeof window & { __avatarErrors: string[] }).__avatarErrors.push(String((event.reason as Error)?.message ?? event.reason));
    });
  });
  await skipOpeningLoader(browser);
  await app.open("/");

  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  // 进站直接停在成像头像并静止：中心墨密度稳定在高值，两次读取一致。
  await expect.poll(async () => {
    const first = await readAvatarField(browser);
    await settle(350);
    const second = await readAvatarField(browser);
    return first && second && first.armed && second.armed
      && first.center > ASSEMBLED_CENTER_MIN && second.center > ASSEMBLED_CENTER_MIN
      && Math.abs(first.center - second.center) < 1e-3
      ? "settled" : "pending";
  }, { timeout: 20_000 }).toBe("settled");
  const restMeta = await readAvatarMeta(browser);
  expect(restMeta).toEqual({ label: "将陈远的点描头像变成像素小伙伴", shape: "portrait", state: "idle" });
  // 粒子接管后静态点描收起。
  await expect.poll(() => readStippleOpacity(browser)).toBe("0");
  const portraitDigest = await readCanvasDigest(browser);
  expect(portraitDigest).not.toBeNull();

  // 点击飞成像素小伙伴：可访问名称切到「回到」，相位进入 mascot 并落定。
  await avatar.click();
  await expect(screen.getByRole("button", "回到陈远的点描头像")).toBeVisible();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);

  // 再次点击：从当前位置回到头像，画面与点击前逐像素一致。
  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 5_000 }).toBe(true);
  await expect(screen.getByRole("button", "将陈远的点描头像变成像素小伙伴")).toBeVisible();
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);

  expect(await browser.evaluate(() => (window as typeof window & { __avatarErrors?: string[] }).__avatarErrors ?? [])).toEqual([]);
});

test("clicking mid-arrival cancels the mascot and returns to the exact portrait without queued playback", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await expect.poll(async () => {
    const field = await readAvatarField(browser);
    return field.armed && field.center > ASSEMBLED_CENTER_MIN;
  }, { timeout: 20_000 }).toBe(true);
  const portraitDigest = await readCanvasDigest(browser);

  await avatar.click();
  // 落形飞行途中再点：从当前位置直接回头像，不排队续播。
  await expect.poll(async () => (await readAvatarMeta(browser))?.state, { timeout: 3_000 }).toBe("mascot");
  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 5_000 }).toBe(true);
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);

  // 没有排队的续播：观察窗内不再离开 idle 头像（缺失只能用有界窗口证明）。
  await settle(2_000);
  expect(await readAvatarMeta(browser)).toMatchObject({ shape: "portrait", state: "idle" });
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);
});

test("keyboard activation shows the instant still mascot and the next press returns", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await expect.poll(async () => {
    const field = await readAvatarField(browser);
    return field.armed && field.center > ASSEMBLED_CENTER_MIN;
  }, { timeout: 20_000 }).toBe(true);
  const portraitDigest = await readCanvasDigest(browser);

  // 程序化聚焦不触发彩蛋：键盘路径直接呈现静止伙伴。
  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.focus();
    return true;
  });
  await browser.keyboard.press("Enter");
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "static" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);
  await expect(screen.getByRole("button", "回到陈远的点描头像")).toBeVisible();
  // 静止帧无动画：短窗两次指纹一致，且不同于头像。
  const stillDigest = await readCanvasDigest(browser);
  await settle(300);
  expect(await readCanvasDigest(browser)).toBe(stillDigest);
  expect(stillDigest).not.toBe(portraitDigest);

  await browser.keyboard.press("Enter");
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 3_000 }).toBe(true);
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);

  // Space 同样完成一次静止伙伴并返回；同一伙伴帧确定性重现。
  await browser.keyboard.press("Space");
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "static" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);
  expect(await readCanvasDigest(browser)).toBe(stillDigest);
  await browser.keyboard.press("Space");
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 3_000 }).toBe(true);
});

test("avatar ink follows the curation theme", async ({ app, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  await expect.poll(async () => {
    const field = await readAvatarField(browser);
    return field.armed && field.center > ASSEMBLED_CENTER_MIN;
  }, { timeout: 20_000 }).toBe(true);

  const lightInk = await readInkBrightness(browser);
  expect(lightInk).not.toBeNull();
  expect(lightInk!).toBeLessThan(120);

  await browser.locator(".curation-theme-toggle").click();
  await expect.poll(() => readInkBrightness(browser), { timeout: 5_000 }).toBeGreaterThan(200);

  await browser.locator(".curation-theme-toggle").click();
  await expect.poll(() => readInkBrightness(browser), { timeout: 5_000 }).toBeLessThan(120);
});

test("mobile profile flight ghost falls back to the static stipple", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/");
  await expect.poll(async () => {
    const field = await readAvatarField(browser);
    return field.armed && field.center > ASSEMBLED_CENTER_MIN;
  }, { timeout: 20_000 }).toBe(true);
  await expect.poll(() => readStippleOpacity(browser)).toBe("0");

  await screen.getByRole("link", "开源关注", { exact: false }).click();
  // 飞行期间头像克隆（ghost）的静态点描必须可见：cloneNode 不复制画布内容。
  await expect.poll(() => browser.evaluate(() => {
    const ghost = document.querySelector<HTMLElement>(".profile-transition-ghost--avatar");
    if (!ghost) return "no-ghost";
    const stipple = ghost.querySelector(".curation-home__avatar-stipple");
    return stipple ? getComputedStyle(stipple).opacity : "missing-img";
  }), { timeout: 10_000 }).toBe("1");
  await expect(browser).toHaveURL(/\/open-source$/u);
  await expect(browser.locator(".profile-transition-ghost")).toHaveCount(0);
});

test("reduced motion shows the still mascot instantly and returns on click", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  // 无进站飞行：武装后首次读取即成像终态。
  await expect.poll(async () => (await readAvatarField(browser)).armed, { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await readAvatarField(browser)).center, { timeout: 1_000 }).toBeGreaterThan(ASSEMBLED_CENTER_MIN);
  expect(await readAvatarMeta(browser)).toEqual({ label: "将陈远的点描头像变成像素小伙伴", shape: "portrait", state: "idle" });

  await avatar.click();
  // reduce 下点击直接落到静止伙伴帧，短于任何动画窗口。
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "static" && current.shape === "mascot";
  }, { timeout: 1_000 }).toBe(true);
  await expect(screen.getByRole("button", "回到陈远的点描头像")).toBeVisible();
  const stillDigest = await readCanvasDigest(browser);
  await settle(300);
  expect(await readCanvasDigest(browser)).toBe(stillDigest);

  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 1_000 }).toBe(true);
});
