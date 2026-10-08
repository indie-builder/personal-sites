import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

// 首访名字序列的行为契约：粒子先成「陈」再成「远」最终落回头像，全程
// 同一批粒子（墨形逐段不同）；帘幕遮罩期间不开演，本会话刷新不再重播，
// 序列中点击立即取消并回到散开，减少动态直接停在头像。断言读画布真实
// 像素并与页内绘制的字形参照比对，不镜像实现细节。
const GRID = 12;
const CENTER_MIN = 0.03;
const SCATTERED_CENTER_MAX = 0.005;
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

const readCenter = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!canvas || !canvas.width) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      if (data[(y * width + x) * 4 + 3] > 0) ink += 1;
    }
  }
  return ink / total;
});

const centerMass = (grid: string) => {
  let filled = 0;
  for (let y = 4; y < 8; y += 1) {
    for (let x = 4; x < 8; x += 1) filled += Number(grid[y * GRID + x]);
  }
  return filled;
};

// 相同占据格下的差异格数。
const gridDistance = (a: string, b: string) => {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
};

// 页内绘制字形参照：与组件同系统中文字体栈、同包围盒居中策略，返回
// 12x12 占据格，仅用于比对，不引用组件内部。
const renderGlyphReference = (browser: import("@e2e-dev/web").Browser, char: string) =>
  browser.evaluate((char: string) => {
    const G = 12;
    const SRC = 200;
    const INSET = 0.1;
    const off = document.createElement("canvas");
    off.width = SRC;
    off.height = SRC;
    const ctx = off.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(SRC * 0.78)}px -apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif`;
    ctx.fillText(char, SRC / 2, SRC / 2);
    const { data } = ctx.getImageData(0, 0, SRC, SRC);
    let minX = SRC;
    let minY = SRC;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < SRC; y += 1) {
      for (let x = 0; x < SRC; x += 1) {
        if (data[(y * SRC + x) * 4 + 3] >= 128) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    const span = 1 - INSET * 2;
    const scale = Math.min(span / (maxX - minX + 1), span / (maxY - minY + 1));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cells = new Array<boolean>(G * G).fill(false);
    // 每格 3x3 采样点，格内有墨即置位，与粒子场的占据语义一致。
    for (let gy = 0; gy < G; gy += 1) {
      for (let gx = 0; gx < G; gx += 1) {
        for (let sy = 0; sy < 3 && !cells[gy * G + gx]; sy += 1) {
          for (let sx = 0; sx < 3; sx += 1) {
            const nx = (gx + (sx + 0.5) / 3) / G;
            const ny = (gy + (sy + 0.5) / 3) / G;
            const px = Math.round(cx + (nx - 0.5) / scale);
            const py = Math.round(cy + (ny - 0.5) / scale);
            if (px < 0 || py < 0 || px >= SRC || py >= SRC) continue;
            if (data[(py * SRC + px) * 4 + 3] >= 128) {
              cells[gy * G + gx] = true;
              break;
            }
          }
        }
      }
    }
    return cells.map((v) => (v ? "1" : "0")).join("");
  }, char);

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

// P1 竞态：字形采样拖到离场帘抬起（reveal 已派发、帘 DOM 未卸载）才完成，
// 序列必须按已流逝时间续上开演，而不是错过 once 监听永远停在散开圈。
test("glyph sampling finishing during the curtain lift still plays the sequence", async ({ app, browser }) => {
  await browser.addInitScript(() => {
    try {
      let release: () => void = () => {};
      (window as typeof window & { __fontsGate?: Promise<void> }).__fontsGate = new Promise((resolve) => {
        release = resolve;
      });
      (window as typeof window & { __releaseFonts?: () => void }).__releaseFonts = release;
      const fonts = document.fonts;
      const orig = fonts.load.bind(fonts);
      fonts.load = ((...args: Parameters<typeof orig>) =>
        (window as typeof window & { __fontsGate: Promise<void> }).__fontsGate.then(() => orig(...args))) as typeof orig;
    } catch {
      // 字体集不可改写时本用例退化为普通首访流程。
    }
  });
  await app.clearState();
  await app.open("/");
  // 帘进入离场相（类名携带 leaving）立即放行字体，采样将在帘 DOM 尚在时完成。
  await expect.poll(() => browser.evaluate(() => document.querySelector(".opening-loader")?.className ?? ""), { timeout: 20_000 }).toContain("opening-loader--leaving");
  await browser.evaluate(() => {
    (window as typeof window & { __releaseFonts?: () => void }).__releaseFonts?.();
    return true;
  });
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  // 修复前：reveal 已错过、帘已卸载，序列永不开演，中心墨量恒为 0。
  await expect.poll(() => readCenter(browser), { timeout: 15_000 }).toBeGreaterThan(CENTER_MIN);
  await expect.poll(async () => {
    const first = await readCenter(browser);
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    const second = await readCenter(browser);
    return first !== null && second !== null && first > CENTER_MIN && second > CENTER_MIN && Math.abs(first - second) < 1e-3;
  }, { timeout: 10_000 }).toBe(true);
});

// P1 竞态：等待揭幕的窗口期（introRef 未建）内点击作废整个开场，迟到的
// reveal 回调不得再开演。遮罩挡指针，用程序化 click 触发同一处理器。
test("a click while awaiting the reveal aborts the pending sequence for good", async ({ app, browser }) => {
  await app.clearState();
  await expect.poll(() => browser.evaluate(() => ({
    armed: document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.dataset.particles === "on",
    loader: Boolean(document.querySelector(".opening-loader")),
  })), { timeout: 20_000 }).toEqual({ armed: true, loader: true });
  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.click();
    return true;
  });
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  // 揭幕后再等两段变形窗口：修复前序列照常开演、中心成字。
  await new Promise<void>((resolve) => setTimeout(resolve, 3500));
  expect((await readCenter(browser))!).toBeLessThan(SCATTERED_CENTER_MAX);
});

// P2 停留：首字变形中途隐藏页面，恢复后必须补完变形并可见地停留陈，
// 而不是立刻冲进下一个字（380ms 停留被隐藏期吞掉）。
test("the character dwell survives a mid-morph hide and resume", async ({ app, browser }) => {
  await app.clearState();
  // 页内 rAF 监视器在中心首现墨点的同一帧隐藏页面（散开态中心恒为空，
  // 首墨必是陈的变形中段），不受测试进程往返延迟影响。
  await browser.evaluate(() => {
    const w = window as typeof window & { __midMorphCaught: boolean };
    w.__midMorphCaught = false;
    const tick = () => {
      if (w.__midMorphCaught) return;
      const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
      if (canvas && canvas.width) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const x0 = Math.floor(width * 0.3);
          const x1 = Math.ceil(width * 0.7);
          const y0 = Math.floor(height * 0.3);
          const y1 = Math.ceil(height * 0.7);
          let ink = 0;
          let total = 0;
          for (let y = y0; y < y1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
              total += 1;
              if (data[(y * width + x) * 4 + 3] > 0) ink += 1;
            }
          }
          if (ink / total > 0.03) {
            w.__midMorphCaught = true;
            Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
            document.dispatchEvent(new Event("visibilitychange"));
            return;
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  });
  await expect.poll(() => browser.evaluate(() => (window as typeof window & { __midMorphCaught: boolean }).__midMorphCaught), { timeout: 25_000 }).toBe(true);
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));
  await browser.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    return true;
  });
  const refChen = (await renderGlyphReference(browser, "陈")) as string;
  const readGrid = () => browser.evaluate(() => {
    const G = 12;
    const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles")!;
    const ctx = canvas.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const cells = new Array<boolean>(G * G).fill(false);
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 40) {
          cells[Math.min(G - 1, Math.floor((y / height) * G)) * G + Math.min(G - 1, Math.floor((x / width) * G))] = true;
        }
      }
    }
    return cells.map((v) => (v ? "1" : "0")).join("");
  });
  // 恢复后采样：陈成形（与参照差异小）到离开陈（差异回升）的间隔即
  // 可见停留时长，必须不小于 300ms。
  let firstChen = -1;
  let leftChen = -1;
  for (let i = 0; i < 60 && leftChen < 0; i += 1) {
    const distance = gridDistance((await readGrid()) as string, refChen);
    if (firstChen < 0) {
      if (distance <= 28) firstChen = i;
    } else if (distance >= 36) {
      leftChen = i;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
  }
  expect(firstChen).toBeGreaterThanOrEqual(0);
  expect(leftChen).toBeGreaterThanOrEqual(0);
  expect((leftChen - firstChen) * 80).toBeGreaterThanOrEqual(300);
});

test("clicking during the name intro cancels the sequence into scatter", async ({ app, screen, browser }) => {
  await app.clearState();
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  // 序列开演后（中心首次成墨）立即点击：取消余下段落并散开。
  await expect.poll(() => readCenter(browser), { timeout: 15_000 }).toBeGreaterThan(CENTER_MIN);
  await screen.getByRole("button", "点描头像", { exact: false }).click();
  await expect(screen.getByRole("button", "聚拢陈远的点描头像")).toBeVisible();
  await expect.poll(() => readCenter(browser), { timeout: 5_000 }).toBeLessThan(SCATTERED_CENTER_MAX);
  // 取消后不再出现任何后续字形：间隔读取仍保持散开。
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));
  expect((await readCenter(browser))!).toBeLessThan(SCATTERED_CENTER_MAX);

  // 再次点击直返头像并静止。
  await screen.getByRole("button", "聚拢陈远的点描头像").click();
  await expect(screen.getByRole("button", "分散陈远的点描头像")).toBeVisible();
  await expect.poll(() => readCenter(browser), { timeout: 5_000 }).toBeGreaterThan(CENTER_MIN);
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
