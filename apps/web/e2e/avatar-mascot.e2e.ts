import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { readAvatarMeta, readCanvasDigest } from "./helpers/avatar.ts";

// 像素小伙伴的持续行为契约：指针选中后进入十段横向故事（各约 10s，一轮
// 约 100s，播完折回第 2 轮无限循环），没有定时自动返回，直到显式再点才
// 逐像素回到头像；快速连点总是从当前位置反转，不排队续播；隐藏/离屏冻结
// 冒险时钟与剩余停留，恢复后续走（时钟只累计可见播放时长）；静止头像不
// 跑动画帧。data-avatar-chapter/-round 只在选中伙伴期间出现，头像态缺失；
// 冒险场景固定浅色墨与暖白底，不随站点主题。全轮次回归用 page-init 的
// rAF/performance.now 相干加速时钟压缩到有界时长。断言读画布真实像素与
// DOM 相位，不镜像实现细节。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const skipOpeningLoader = (browser: import("@e2e-dev/web").Browser) =>
  browser.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

const waitIdlePortrait = async (browser: import("@e2e-dev/web").Browser, timeout: number) => {
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout }).toBe(true);
};

// 十段横向故事的段落键（顺序即播放顺序）；轮数自 1 起，gate 之后折回。
const CHAPTERS = ["hurdle", "gap", "stairs", "bump", "pushbox", "lift", "movingplatform", "crouch", "spring", "gate"] as const;
const CHAPTER_KEY = /^(hurdle|gap|stairs|bump|pushbox|lift|movingplatform|crouch|spring|gate)$/u;

const readChapterMeta = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const button = document.querySelector<HTMLButtonElement>(".curation-home__avatar");
  if (!button) return null;
  return { chapter: button.getAttribute("data-avatar-chapter"), round: button.getAttribute("data-avatar-round") };
});

// page-init 相干加速：同一基准、同一倍率包装 performance.now 与 rAF 时间戳，
// 页面内一切按 rAF/performance 计时的推进（含每段 10s 的故事时钟）等比加快，
// 100s 一轮压缩到有界的实时时长；逐帧采样段落属性，轮内不漏段。
const accelerateAdventureClock = (browser: import("@e2e-dev/web").Browser, timeScale: number) =>
  browser.addInitScript((scale: number) => {
    const scope = window as typeof window & { __adventureLog?: string[] };
    const realNow = performance.now.bind(performance);
    const epoch = realNow();
    performance.now = () => epoch + (realNow() - epoch) * scale;
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      nativeRaf((now) => callback(epoch + (now - epoch) * scale));
    scope.__adventureLog = [];
    const sample = () => {
      const button = document.querySelector<HTMLElement>(".curation-home__avatar");
      if (button) {
        const chapter = button.getAttribute("data-avatar-chapter");
        const round = button.getAttribute("data-avatar-round");
        if (chapter && round) {
          const log = scope.__adventureLog!;
          const entry = `${round}:${chapter}`;
          if (log.at(-1) !== entry) log.push(entry);
        }
      }
      nativeRaf(sample);
    };
    nativeRaf(sample);
  }, timeScale);

const readAdventureLog = (browser: import("@e2e-dev/web").Browser) =>
  browser.evaluate(() => (window as typeof window & { __adventureLog?: string[] }).__adventureLog ?? []);

// 段落键与画布指纹同帧读取：跨段比较的像素证据不受两次读取之间的推进影响。
const readChapterWithDigest = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const button = document.querySelector<HTMLElement>(".curation-home__avatar");
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!canvas || canvas.width === 0) return null;
  const url = canvas.toDataURL();
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i += 1) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return { chapter: button?.getAttribute("data-avatar-chapter") ?? null, digest: (h >>> 0).toString(16) };
});

// 场景配色证据：画布像素里深墨（<120）与暖白（>200）的占比、墨像素平均
// 亮度，以及按钮底色亮度（暖白底落在按钮背景时的另一实现位置）。
const readSceneInk = (browser: import("@e2e-dev/web").Browser) => browser.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  const button = document.querySelector<HTMLElement>(".curation-home__avatar");
  if (!canvas || !button || canvas.width === 0) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const total = data.length / 4;
  let dark = 0;
  let light = 0;
  let inkSum = 0;
  let inkCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 60) continue;
    const level = (data[i] + data[i + 1] + data[i + 2]) / 3;
    inkSum += level;
    inkCount += 1;
    if (level < 120) dark += 1;
    else if (level > 200) light += 1;
  }
  const rgb = /rgba?\((\d+), (\d+), (\d+)/u.exec(getComputedStyle(button).backgroundColor);
  return {
    darkInk: dark / total,
    lightGround: light / total,
    inkMean: inkCount === 0 ? null : inkSum / inkCount,
    buttonGround: rgb ? (Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3])) / (3 * 255) : 0,
  };
});

test("the mascot keeps stepping past the old auto-return boundary until an explicit click", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);
  const portraitDigest = await readCanvasDigest(browser);
  expect(portraitDigest).not.toBeNull();

  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);

  // 旧彩蛋设计约 4s 自动回头像：越过该边界后画布仍在逐帧变化且保持选中。
  await settle(4_200);
  await expect.poll(async () => {
    const first = await readCanvasDigest(browser);
    await settle(300);
    const second = await readCanvasDigest(browser);
    const meta = await readAvatarMeta(browser);
    return first !== null && second !== null && first !== second && meta?.state === "mascot" && meta.shape === "mascot"
      ? "live" : "pending";
  }, { timeout: 5_000 }).toBe("live");

  // 没有排队收尾：再等一窗仍是选中的伙伴。
  await settle(1_000);
  expect(await readAvatarMeta(browser)).toMatchObject({ shape: "mascot", state: "mascot" });

  // 显式再点：逐像素回到点击前的头像终态。
  await avatar.click();
  await waitIdlePortrait(browser, 5_000);
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);
  await expect(screen.getByRole("button", "将陈远的点描头像变成像素小伙伴")).toBeVisible();
});

test("rapid clicks reverse direction from the current positions without queued playback", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);
  const portraitDigest = await readCanvasDigest(browser);

  // 连续两轮「进入后立刻取消」：都从飞行途中反转，终点都是逐像素头像。
  for (let round = 0; round < 2; round += 1) {
    await avatar.click();
    await expect.poll(async () => (await readAvatarMeta(browser))?.state, { timeout: 3_000 }).toBe("mascot");
    await avatar.click();
    await waitIdlePortrait(browser, 5_000);
    expect(await readCanvasDigest(browser)).toBe(portraitDigest);
  }

  // 落定踏步后取消，以及返回途中再反转回伙伴，最后都收在头像。
  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);
  await avatar.click();
  await expect.poll(async () => (await readAvatarMeta(browser))?.state, { timeout: 3_000 }).toBe("returning");
  await avatar.click();
  await expect.poll(async () => (await readAvatarMeta(browser))?.state, { timeout: 3_000 }).toBe("mascot");
  await avatar.click();
  await waitIdlePortrait(browser, 5_000);
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);

  // 无排队的续播：观察窗内保持 idle 头像。
  await settle(2_000);
  expect(await readAvatarMeta(browser)).toMatchObject({ shape: "portrait", state: "idle" });
});

test("hiding mid-walk freezes the mascot and resume continues the loop", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);

  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);

  // 踏步中隐藏页面：画面与计时一并冻结。
  await browser.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    return true;
  });
  const frozenAt = await readCanvasDigest(browser);
  await settle(600);
  expect(await readCanvasDigest(browser)).toBe(frozenAt);

  // 恢复可见：不整段吞掉也不重播，从冻结处续走，仍是选中的伙伴。
  await browser.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    return true;
  });
  await expect.poll(async () => {
    const first = await readCanvasDigest(browser);
    await settle(250);
    const second = await readCanvasDigest(browser);
    return first !== null && second !== null && first !== second ? "resumed" : "pending";
  }, { timeout: 5_000 }).toBe("resumed");
  expect(await readAvatarMeta(browser)).toMatchObject({ shape: "mascot", state: "mascot" });

  await avatar.click();
  await waitIdlePortrait(browser, 5_000);
});

test("story chapter attributes appear only while the mascot is selected", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);

  // 头像静止态：没有段落属性，画面跨秒稳定（静止头像不跑动画帧）。
  expect(await readChapterMeta(browser)).toEqual({ chapter: null, round: null });
  const idleDigest = await readCanvasDigest(browser);
  await settle(1_000);
  expect(await readCanvasDigest(browser)).toBe(idleDigest);
  expect(await readChapterMeta(browser)).toEqual({ chapter: null, round: null });

  // 点击进入连续冒险：首段段落键与第 1 轮随选择出现。
  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);
  await expect.poll(async () => (await readChapterMeta(browser))?.round, { timeout: 3_000 }).toBe("1");
  const active = await readChapterMeta(browser);
  expect(active?.chapter ?? "").toMatch(CHAPTER_KEY);

  // 显式回头像：段落属性一并消失。
  await avatar.click();
  await waitIdlePortrait(browser, 5_000);
  expect(await readChapterMeta(browser)).toEqual({ chapter: null, round: null });
});

test("one continuous run plays all ten stories in order and wraps into round 2", { timeout: 90_000 }, async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await accelerateAdventureClock(browser, 8);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);

  await avatar.click();
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "mascot" && current.shape === "mascot";
  }, { timeout: 3_000 }).toBe(true);

  // 第一段→第二段：段落键变化伴随真实像素变化，不只是属性改名。
  await expect.poll(async () => (await readChapterWithDigest(browser))?.chapter, { timeout: 5_000 }).toBe("hurdle");
  const firstChapter = await readChapterWithDigest(browser);
  await expect.poll(async () => (await readChapterWithDigest(browser))?.chapter, { timeout: 5_000 }).toBe("gap");
  const secondChapter = await readChapterWithDigest(browser);
  expect(firstChapter?.digest).toBeTruthy();
  expect(secondChapter?.digest).not.toBe(firstChapter?.digest);

  // 隐藏页面：冒险时钟只累计可见播放时长，段落属性与画面一并冻结。
  // 冻结基线在隐藏生效后读取，避免读取间隙恰好跨过段落边界。
  await browser.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    return true;
  });
  const frozenChapter = await readChapterWithDigest(browser);
  const logAtFreeze = await readAdventureLog(browser);
  await settle(1_500);
  expect((await readChapterWithDigest(browser))?.digest).toBe(frozenChapter?.digest);
  expect(await readAdventureLog(browser)).toEqual(logAtFreeze);
  await browser.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    return true;
  });

  // 恢复可见后续走：十段顺序播放，gate 之后折回第 2 轮的 hurdle。
  await expect.poll(async () => (await readAdventureLog(browser)).length, { timeout: 40_000 }).toBeGreaterThanOrEqual(11);
  expect((await readAdventureLog(browser)).slice(0, 11)).toEqual([...CHAPTERS.map((chapter) => `1:${chapter}`), "2:hurdle"]);

  // 显式回头像：段落属性消失。
  await avatar.click();
  await waitIdlePortrait(browser, 10_000);
  expect(await readChapterMeta(browser)).toEqual({ chapter: null, round: null });
});

test("the story scene keeps fixed light ink across site themes while the portrait still follows the theme", async ({ app, screen, browser }) => {
  await skipOpeningLoader(browser);
  await app.open("/");
  const avatar = screen.getByRole("button", "点描头像", { exact: false });
  await expect(avatar).toBeVisible();
  await waitIdlePortrait(browser, 20_000);

  await avatar.click();
  await expect.poll(async () => (await readChapterMeta(browser))?.round, { timeout: 3_000 }).toBe("1");
  const lightScene = await readSceneInk(browser);
  expect(lightScene?.darkInk ?? 0).toBeGreaterThan(0.005);

  // 深色主题：冒险画面仍是固定深墨加暖白底，不跟随主题把墨翻白。
  await browser.locator(".curation-theme-toggle").click();
  await expect.poll(async () => (await readSceneInk(browser))?.darkInk ?? 0, { timeout: 3_000 }).toBeGreaterThan(0.005);
  const darkScene = await readSceneInk(browser);
  expect((darkScene?.lightGround ?? 0) > 0.25 || (darkScene?.buttonGround ?? 0) > 0.8).toBe(true);

  // 回到头像：头像态墨色仍随主题（既有主题路径没有被场景配色替换）。
  await avatar.click();
  await waitIdlePortrait(browser, 5_000);
  await expect.poll(async () => (await readSceneInk(browser))?.inkMean ?? 0, { timeout: 3_000 }).toBeGreaterThan(200);
});
