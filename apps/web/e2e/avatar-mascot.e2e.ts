import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { readAvatarMeta, readCanvasDigest } from "./helpers/avatar.ts";

// 像素小伙伴的持续行为契约：指针选中后原地踏步没有定时自动返回，越过
// 旧彩蛋 4s 收尾边界仍在走、形态保持 mascot，直到显式再点才逐像素回到
// 头像；快速连点总是从当前位置反转，不排队续播；隐藏/离屏冻结踏步与
// 剩余停留，恢复后续走。断言读画布真实像素与 DOM 相位，不镜像实现细节。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const skipOpeningLoader = (browser: import("@e2e-dev/web").Browser) =>
  browser.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));

const waitIdlePortrait = async (browser: import("@e2e-dev/web").Browser, timeout: number) => {
  await expect.poll(async () => {
    const current = await readAvatarMeta(browser);
    return current !== null && current.state === "idle" && current.shape === "portrait";
  }, { timeout }).toBe(true);
};

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
