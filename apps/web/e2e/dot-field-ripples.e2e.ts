import { expect, test } from "./helpers/loader-key.ts";

// 技术词条底纹水波的行为契约：细指针掠过信号场时背景点阵径向偏移成波，
// 波在约 1.2s 内落定，画布定格回与 CSS 静态点阵等价的帧并停表（无空转 RAF）。
// 断言读画布自身位图（toDataURL）与 data 属性，不整页截图——词条弹幕与
// 视差会让整页像素持续漂移。弹幕泳道不受背景波纹影响，仍保持运行。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const readField = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const field = document.querySelector<HTMLElement>(".interactive-dot-field");
  const canvas = field?.querySelector<HTMLCanvasElement>("canvas") ?? null;
  if (!field || !canvas) throw new Error("dot field or ripple canvas missing");
  return {
    frame: canvas.toDataURL(),
    ready: field.dataset.dotRipples ?? null,
    rippling: canvas.dataset.rippling ?? null,
  };
});

const readTrackPlayState = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const track = document.querySelector<HTMLElement>(".interactive-dot-field .interactive-dot-field__track");
  if (!track) throw new Error("dot field track missing");
  return track.getAnimations()[0]?.playState ?? null;
});

test("dot field lattice ripples under the mouse and settles back to the static frame", async ({ app, browser }) => {
  await browser.addInitScript(() => {
    const testWindow = window as typeof window & { __rippleErrors: string[] };
    testWindow.__rippleErrors = [];
    window.addEventListener("error", (event) => testWindow.__rippleErrors.push(event.message));
    window.addEventListener("unhandledrejection", (event) => {
      testWindow.__rippleErrors.push(String((event.reason as Error)?.message ?? event.reason));
    });
  });
  await app.open("/");

  await expect.poll(async () => (await readField(browser)).ready, { timeout: 10_000 }).toBe("ready");
  expect(await browser.evaluate(() => getComputedStyle(document.querySelector(".interactive-dot-field")!).backgroundImage)).toBe("none");
  expect(await browser.evaluate(() => {
    const field = document.querySelector(".interactive-dot-field")!.getBoundingClientRect();
    const canvas = document.querySelector(".interactive-dot-field canvas")!.getBoundingClientRect();
    return Math.abs(field.width - canvas.width) < 1 && Math.abs(field.height - canvas.height) < 1;
  })).toBe(true);
  const staticFrame = (await readField(browser)).frame;

  await browser.evaluate(() => {
    document.querySelector<HTMLElement>(".interactive-dot-field")!.scrollIntoView({ block: "center" });
    return null;
  });
  const box = await browser.evaluate(() => {
    const rect = document.querySelector<HTMLElement>(".interactive-dot-field")!.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });
  const y = box.top + box.height / 2;
  for (const fraction of [0.15, 0.35, 0.55, 0.75, 0.95]) {
    await browser.mouse.move(box.left + box.width * fraction, y);
    await settle(90);
  }

  const rippling = await readField(browser);
  expect(rippling.rippling).toBe("true");
  expect(rippling.frame).not.toBe(staticFrame);

  await settle(1_600);
  await expect.poll(async () => (await readField(browser)).rippling, { timeout: 2_000 }).toBe(null);
  await expect.poll(async () => (await readField(browser)).frame, { timeout: 2_000 }).toBe(staticFrame);

  await expect.poll(() => readTrackPlayState(browser)).toBe("running");
  expect(await browser.evaluate(() => (
    window as typeof window & { __rippleErrors?: string[] }
  ).__rippleErrors ?? [])).toEqual([]);
});
