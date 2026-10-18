import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { readAvatarMeta } from "./helpers/avatar.ts";
import { gridDistance, readCenter, renderGlyphReference } from "./helpers/avatar-glyph.ts";

// 首访名字序列的行为契约：粒子先成「陈」再成「远」最终落回头像，全程
// 同一批粒子（墨形逐段不同）；帘幕遮罩期间不开演，本会话刷新不再重播，
// 序列中点击立即取消并回到成像头像，减少动态直接停在头像。断言读画布真实
// 像素并与页内绘制的字形参照比对，不镜像实现细节。
const GRID = 12;
const CENTER_MIN = 0.03;
const PLATEAU_MIN_MS = 250;

type Frame = { t: number; loader: boolean; grid: string };

// 逐帧记录头像画布 12x12 墨点占据格 + 帘幕在场状态，序列停止后置 done。
const installRecorder = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const G = 12;
  const w = window as typeof window & { __intro: { frames: { t: number; loader: boolean; grid: string }[]; done: boolean } };
  w.__intro = { frames: [], done: false };
  const sample = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
    const loader = Boolean(document.querySelector(".opening-loader"));
    let grid = "";
    if (canvas && canvas.width) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cells = new Array<boolean>(G * G).fill(false);
        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            if (data[(y * width + x) * 4 + 3] > 40) {
              cells[Math.min(G - 1, Math.floor((y / height) * G)) * G + Math.min(G - 1, Math.floor((x / width) * G))] = true;
            }
          }
        }
        grid = cells.map((v) => (v ? "1" : "0")).join("");
      }
    }
    return { t: Math.round(performance.now()), loader, grid };
  };
  const t0 = performance.now();
  const tick = () => {
    w.__intro.frames.push(sample());
    const frames = w.__intro.frames;
    const last = frames[frames.length - 1];
    const firstFree = frames.find((f) => !f.loader);
    let stable = true;
    for (let i = frames.length - 1; i >= 0; i -= 1) {
      if (last.t - frames[i].t > 1500) break;
      if (frames[i].grid !== last.grid) stable = false;
    }
    if (last.t - t0 > 30000 || (firstFree && last.t - firstFree.t > 3500 && stable)) {
      w.__intro.done = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
});

const recorderDone = (browser: import("@e2e-dev/web").Browser) =>
  browser.evaluate(() => (window as typeof window & { __intro?: { done: boolean } }).__intro?.done ?? false);

const readRecording = (browser: import("@e2e-dev/web").Browser) =>
  browser.evaluate(() => (window as typeof window & { __intro?: { frames: Frame[] } }).__intro?.frames ?? []);

const centerMass = (grid: string) => {
  let filled = 0;
  for (let y = 4; y < 8; y += 1) {
    for (let x = 4; x < 8; x += 1) filled += Number(grid[y * GRID + x]);
  }
  return filled;
};

// 把逐帧记录折叠成时长不小于 PLATEAU_MIN_MS 的稳定段。
const plateaus = (frames: Frame[]) => {
  const runs: Array<{ grid: string; start: number; end: number; loader: boolean }> = [];
  for (const frame of frames) {
    const prev = runs[runs.length - 1];
    if (prev && prev.grid === frame.grid) prev.end = frame.t;
    else runs.push({ grid: frame.grid, start: frame.t, end: frame.t, loader: frame.loader });
  }
  return runs.filter((run) => run.end - run.start >= PLATEAU_MIN_MS);
};

test("first visit spells 陈 then 远 and settles into the avatar after the curtain lifts", async ({ app, browser }) => {
  await app.clearState();
  await installRecorder(browser);
  await expect.poll(() => recorderDone(browser), { timeout: 40_000 }).toBe(true);
  const frames = (await readRecording(browser)) as Frame[];
  expect(frames.length).toBeGreaterThan(30);

  const loaderGone = frames.findIndex((frame) => !frame.loader);
  expect(loaderGone).toBeGreaterThan(0);

  // 帘幕仍在时不得开演名字：遮罩期间没有中心成字的稳定段。
  for (const run of plateaus(frames.filter((frame) => frame.loader))) {
    expect(centerMass(run.grid)).toBeLessThan(10);
  }

  // 帘后依次出现三个可读稳定段：陈、远、头像。
  const revealed = plateaus(frames.filter((frame) => !frame.loader)).filter((run) => centerMass(run.grid) >= 10);
  expect(revealed.length).toBe(3);
  const [chen, yuan, avatar] = revealed;
  expect(chen.start).toBeLessThan(yuan.start);
  expect(yuan.start).toBeLessThan(avatar.start);

  // 字形身份与顺序：页内参照比对，陈/远各自最近匹配。
  const refChen = (await renderGlyphReference(browser, "陈")) as string;
  const refYuan = (await renderGlyphReference(browser, "远")) as string;
  expect(gridDistance(chen.grid, refChen)).toBeLessThan(gridDistance(chen.grid, refYuan));
  expect(gridDistance(yuan.grid, refYuan)).toBeLessThan(gridDistance(yuan.grid, refChen));
  // 头像终态不是任何字形，且作为末段长时间静止。
  expect(gridDistance(avatar.grid, refChen)).toBeGreaterThan(gridDistance(chen.grid, refChen));
  expect(avatar.end - avatar.start).toBeGreaterThan(1000);
  expect((await readCenter(browser))!).toBeGreaterThan(CENTER_MIN);
});

test("clicking during the name intro cancels the sequence into the idle portrait", async ({ app, screen, browser }) => {
  await app.clearState();
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  // 序列开演后立即点击：取消余下段落，从当前位置直接回头像。
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "intro";
  }, { timeout: 15_000 }).toBe(true);
  await screen.getByRole("button", "点描头像", { exact: false }).click();
  // 开场中的点击是「先回头像」：此刻的下一个动作才是变成伙伴。
  await expect(screen.getByRole("button", "将陈远的点描头像变成像素小伙伴")).toBeVisible();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout: 5_000 }).toBe(true);
  await expect.poll(() => readCenter(browser), { timeout: 5_000 }).toBeGreaterThan(CENTER_MIN);
  // 取消后不再出现任何后续字形：间隔读取仍稳定在头像。
  const first = await readCenter(browser);
  await new Promise<void>((resolve) => setTimeout(resolve, 1_200));
  const second = await readCenter(browser);
  expect(Math.abs(second! - first!)).toBeLessThan(1e-3);
});

test("the name intro plays once per session and stays assembled after reload", async ({ app, browser }) => {
  await app.clearState();
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => readCenter(browser), { timeout: 20_000 }).toBeGreaterThan(CENTER_MIN);

  // 同会话刷新：无仪式、无名字序列，武装后直接成像且静止。
  await app.open("/");
  await expect(browser.locator(".opening-loader")).toHaveCount(0);
  await expect.poll(() => browser.evaluate(() => document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.dataset.particles === "on"), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => readCenter(browser), { timeout: 1_000 }).toBeGreaterThan(CENTER_MIN);
});

test("reduced motion settles straight to the avatar even on the ceremony visit", async ({ app, browser, screen }) => {
  await app.clearState();
  await emulateReducedMotion(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  // 无名字序列：武装后首次读取即头像成像终态。
  await expect.poll(() => browser.evaluate(() => document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.dataset.particles === "on"), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => readCenter(browser), { timeout: 500 }).toBeGreaterThan(CENTER_MIN);
});
