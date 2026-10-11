import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import {
  AVATAR_STAGE_RECORDER_SOURCE,
  FUN_SHAPES,
  readAvatarMeta,
  readAvatarStageLog,
  readCanvasDigest,
  settledStageRuns,
  type AvatarStageLog,
} from "./helpers/avatar-surprises.ts";


const FUN_LIST = FUN_SHAPES as readonly string[];
const isFunShape = (shape: string | null | undefined) => FUN_LIST.includes(shape ?? "");

const skipOpeningLoader = (browser: import("@e2e-dev/web").Browser) =>
  browser.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

const waitIdlePortrait = (browser: import("@e2e-dev/web").Browser, timeout: number) =>
  expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout }).toBe(true);

test("all nine surprise forms are reachable and pixel-distinct through still activations", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);
  const portraitDigest = await readCanvasDigest(browser);
  expect(portraitDigest).not.toBeNull();

  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.focus();
    return true;
  });
  const seen: Array<{ digest: string; shape: string }> = [];
  for (let activation = 0; activation < 9; activation += 1) {
    await browser.keyboard.press("Enter");
    await expect.poll(async () => {
      const current = await readAvatarMeta(browser);
      return current !== null && current.state === "static" && isFunShape(current.shape);
    }, { timeout: 3_000 }).toBe(true);
    const still = await readAvatarMeta(browser);
    const digest = await readCanvasDigest(browser);
    expect(digest).not.toBeNull();
    // 同袋相邻不重复（含上一轮边界）。
    const previous = seen.at(-1);
    if (previous) expect(still?.shape).not.toBe(previous.shape);
    seen.push({ digest: digest!, shape: still?.shape ?? "" });
    await browser.keyboard.press("Enter");
    await waitIdlePortrait(browser, 3_000);
  }

  expect(seen.map((entry) => entry.shape).sort()).toEqual([...FUN_LIST].sort());
  // 各形真实像素互不相同，也都不是头像。
  expect(new Set(seen.map((entry) => entry.digest)).size).toBe(FUN_LIST.length);
  expect(seen.every((entry) => entry.digest !== portraitDigest)).toBe(true);
});

test("interrupted pointer tracks and keyboard forms share the last displayed shape", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);
  const portraitDigest = await readCanvasDigest(browser);
  let previousStatic: string | null = null;

  for (let round = 0; round < 6; round += 1) {
    await avatar.click();
    const interrupted = await browser.evaluate(() => new Promise<string>((resolve) => {
      const button = document.querySelector<HTMLButtonElement>(".curation-home__avatar")!;
      const observer = new MutationObserver(() => {
        const shape = button.dataset.avatarShape ?? "";
        if (shape !== "transition" && shape !== "portrait" && button.dataset.avatarState === "surprise") {
          observer.disconnect();
          button.click();
          resolve(shape);
        }
      });
      observer.observe(button, { attributes: true, attributeFilter: ["data-avatar-shape"] });
    }));
    expect(isFunShape(interrupted)).toBe(true);
    if (previousStatic !== null) expect(interrupted).not.toBe(previousStatic);
    await waitIdlePortrait(browser, 3_000);
    await browser.keyboard.press("Enter");
    await expect.poll(async () => (await readAvatarMeta(browser))?.state, { timeout: 3_000 }).toBe("static");
    const still = await readAvatarMeta(browser);
    expect(isFunShape(still?.shape)).toBe(true);
    expect(still?.shape).not.toBe(interrupted);
    expect(await readCanvasDigest(browser)).not.toBe(portraitDigest);
    previousStatic = still?.shape ?? null;
    await browser.keyboard.press("Enter");
    await waitIdlePortrait(browser, 3_000);
  }
});

test("pointer tracks never settle the same form back to back across plays", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);
  expect(await browser.evaluate<boolean>(AVATAR_STAGE_RECORDER_SOURCE)).toBe(true);
  const portraitDigest = await readCanvasDigest(browser);
  expect(portraitDigest).not.toBeNull();

  for (let round = 0; round < 3; round += 1) {
    await avatar.click();
    await expect.poll(async () => (await readAvatarMeta(browser))?.state !== "idle", { timeout: 3_000 }).toBe(true);
    await waitIdlePortrait(browser, 8_000);
  }

  const log = (await readAvatarStageLog(browser)) as AvatarStageLog;
  const funRuns = settledStageRuns(log.events)
    .filter((run) => isFunShape(run.shape) && run.end - run.start >= 120);
  // 每轮至少定格一个趣味形。
  expect(funRuns.length).toBeGreaterThanOrEqual(3);
  // 相邻定格形（轨道内与轮边界）不重复。
  for (let i = 1; i < funRuns.length; i += 1) {
    expect(funRuns[i].shape).not.toBe(funRuns[i - 1].shape);
  }
  // 定格形的像素指纹确有采集，且都与头像不同。
  for (const run of funRuns) {
    const digests = log.pixels[run.shape] ?? [];
    expect(digests.length).toBeGreaterThan(0);
    expect(digests).not.toContain(portraitDigest);
  }
});
