import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { expect, test } from "./helpers/loader-key.ts";

test.beforeEach(async ({ app, browser }) => {
  await browser.setViewport({ height: 900, width: 1440 });
  await app.open("/curation");
  await expect(browser.locator("[data-profile-line]").first()).toBeVisible();
});

test("greeting width does not move the assistant's coordinate origin", async ({ browser }) => {
  const drift = await browser.evaluate(() => {
    const title = document.getElementById("profile-introduction")!;
    const walker = document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!;
    walker.getAnimations().forEach((animation) => animation.pause());
    title.textContent = "Hello,";
    const before = walker.getBoundingClientRect().x;
    title.textContent = "こんにちは、";
    return walker.getBoundingClientRect().x - before;
  });
  expect(Math.abs(drift)).toBeLessThan(1);
});

test("assistant starts at the first biography line instead of the greeting", async ({ screen, browser }) => {
  await emulateReducedMotion(browser);
  await browser.reload();
  const assistant = screen.getByRole("button", "和像素助手聊聊", { exact: false });
  await expect(assistant).toBeEnabled();
  // 框架无 locator.evaluate：按钮在页面内按 aria-label 直取，定位代码逐字保留。
  const position = await browser.evaluate(() => {
    const element = document.querySelector('[aria-label="和像素助手聊聊"]')!;
    const character = element.getBoundingClientRect();
    const firstLine = document.querySelector("[data-profile-line]")!.getBoundingClientRect();
    return { x: character.left - firstLine.left, y: firstLine.top - character.bottom, inBody: !!element.closest(".profile-body-assistant") };
  });
  expect(position.inBody).toBe(true);
  expect(Math.abs(position.x)).toBeLessThan(1);
  expect(Math.abs(position.y)).toBeLessThan(3);
});

test("first downward jump survives greeting changes and lands before text recoil", async ({ browser }) => {
  // 旧 locator.evaluate 是严格单匹配；querySelector 会静默取第一个，重复节点漏检，不唯一即 throw。
  await expect.poll(() => browser.evaluate(() => {
    const matches = document.querySelectorAll('[aria-label="和像素助手聊聊"]');
    if (matches.length !== 1) throw new Error(`expected exactly one assistant button, found ${matches.length}`);
    return matches[0].parentElement!.getAnimations().length;
  })).toBeGreaterThan(0);
  await browser.evaluate(() => {
    const matches = document.querySelectorAll('[aria-label="和像素助手聊聊"]');
    if (matches.length !== 1) throw new Error(`expected exactly one assistant button, found ${matches.length}`);
    const element = matches[0].parentElement!;
    element.getAnimations().forEach((animation) => animation.finish());
    return null;
  });
  const result = await browser.evaluate(async () => {
    const matches = document.querySelectorAll('[aria-label="和像素助手聊聊"]');
    if (matches.length !== 1) throw new Error(`expected exactly one assistant button, found ${matches.length}`);
    const element = matches[0].parentElement!;
    const jump = await new Promise<Animation>((resolve, reject) => {
      const deadline = performance.now() + 3000;
      const check = () => {
        const animation = element.getAnimations()[0];
        if (element.getAttribute("data-motion") === "jump" && animation) {
          animation.pause();
          resolve(animation);
        } else if (performance.now() > deadline) reject(new Error("首次跳跃未开始"));
        else requestAnimationFrame(check);
      };
      check();
    });
    jump.currentTime = 300;
    const before = element.getBoundingClientRect().top;
    document.getElementById("profile-introduction")!.textContent = "こんにちは、";
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const cancelled = jump.playState === "idle";
    const after = element.getBoundingClientRect().top;
    const line = document.querySelectorAll<HTMLElement>(".curation-home__bio p")[1].querySelector<HTMLElement>("[data-profile-line]")!;
    const earlyRecoil = line.getAnimations().length;
    if (!cancelled) jump.finish();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return {
      cancelled, drift: after - before, earlyRecoil,
      landedLane: element.getAttribute("data-lane"),
      footGap: line.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
      recoil: line.getAnimations().length,
    };
  });
  expect(result.cancelled).toBe(false);
  expect(Math.abs(result.drift)).toBeLessThan(1);
  expect(result.earlyRecoil).toBe(0);
  expect(result.landedLane).toBe("1");
  expect(Math.abs(result.footGap)).toBeLessThan(3);
  expect(result.recoil).toBe(1);
});

test("the sprite actually descends on its first jump without inserting text lines", async ({ browser }) => {
  // data-motion/data-lane 要落在定位器断言上：单条 xpath 取按钮父元素，等价旧 locator("..")。
  const walker = browser.locator("xpath=//*[@aria-label='和像素助手聊聊']/..");
  await expect.poll(() => browser.evaluate(() =>
    document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!.getAnimations().length,
  )).toBeGreaterThan(0);
  const initial = await browser.evaluate(() => ({
    top: document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!.getBoundingClientRect().top,
    lines: document.querySelectorAll("[data-profile-line]").length,
  }));
  // 只跳过漫长的水平行走；整段跳跃按真实时间播完。
  await browser.evaluate(() => {
    document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!.getAnimations().forEach((animation) => animation.finish());
    return null;
  });
  await expect(walker).toHaveAttribute("data-motion", "jump");
  await browser.evaluate(() => {
    document.getElementById("profile-introduction")!.textContent = "こんにちは、";
    return null;
  });
  await expect(walker).toHaveAttribute("data-lane", "1");
  await expect.poll(() => browser.evaluate(() => {
    const element = document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!;
    return Math.abs(
      document.querySelectorAll(".curation-home__bio p")[1].querySelector("[data-profile-line]")!.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
    );
  })).toBeLessThan(3);
  const descended = await browser.evaluate(() => document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!.getBoundingClientRect().top);
  expect(descended - initial.top).toBeGreaterThan(15);
  await expect(browser.locator("[data-profile-line]")).toHaveCount(initial.lines);
});

test("assistant enters only after the English-to-Chinese introduction finishes", async ({ screen, browser }) => {
  // 文档流式响应未完时 DCL 晚于壳层 hydration，goto 返回后英文阶段可能已播完（旧 waitUntil:"commit"
  // 正是为此）。框架没有 commit 等价物：init script 在文档最早期装记录器，全程录下阶段与助手存在性，
  // 再导航、再断言录制到的完整序列。
  await browser.addInitScript(() => {
    const log: Array<{ assistants: number; phase: string; t: number }> = [];
    const record = () => {
      const phase = document.querySelector(".curation-home__bio")?.getAttribute("data-introduction-phase");
      if (!phase) return;
      const assistants = document.querySelectorAll('[aria-label="和像素助手聊聊"]').length;
      const last = log[log.length - 1];
      if (!last || last.phase !== phase || last.assistants !== assistants) {
        log.push({ assistants, phase, t: performance.now() });
      }
    };
    new MutationObserver(record).observe(document, {
      attributes: true, attributeFilter: ["data-introduction-phase"], childList: true, subtree: true,
    });
    (window as typeof window & { __introPhases: typeof log }).__introPhases = log;
  });
  await browser.goto("/");
  // 完成等待沿用旧整条用例 30s 预算；阶段间隔预算在下方按录制时间戳断言。
  await expect.poll(() => browser.evaluate(() => {
    const log = (window as typeof window & { __introPhases?: Array<{ assistants: number; phase: string; t: number }> }).__introPhases;
    const last = log?.[log.length - 1];
    return last ? last.phase === "complete" && last.assistants > 0 : false;
  }), { timeout: 30_000 }).toBe(true);
  const log = await browser.evaluate(() => (
    (window as typeof window & { __introPhases: Array<{ assistants: number; phase: string; t: number }> }).__introPhases
  ));
  const phases = log.map((entry) => entry.phase);
  const englishAt = phases.indexOf("english");
  const erasingAt = phases.indexOf("erasing");
  const chineseAt = phases.indexOf("chinese");
  const enteredAt = log.findIndex((entry) => entry.assistants > 0);
  expect(englishAt).toBeGreaterThanOrEqual(0);
  expect(erasingAt).toBeGreaterThan(englishAt);
  expect(chineseAt).toBeGreaterThan(erasingAt);
  expect(enteredAt).toBeGreaterThan(chineseAt);
  expect(phases[enteredAt]).toBe("complete");
  expect(log.slice(0, enteredAt).every((entry) => entry.assistants === 0)).toBe(true);
  expect(log[log.length - 1]).toMatchObject({ assistants: 1, phase: "complete" });
  // 旧用例的时间约束：整条序列 30s 内完成，每个阶段等待不超过 20s（按录制时间戳等价复现）。
  expect(log[log.length - 1].t).toBeLessThanOrEqual(30_000);
  for (let index = 1; index < log.length; index += 1) {
    expect(log[index].t - log[index - 1].t).toBeLessThanOrEqual(20_000);
  }
  const assistant = screen.getByRole("button", "和像素助手聊聊", { exact: false });
  await expect(assistant).toBeEnabled();
  const state = await browser.evaluate(() => {
    const button = document.querySelector('[aria-label="和像素助手聊聊"]')!;
    return {
      // evaluate 返回值必须 JSON：可选链取不到时 undefined 落回 null。
      entered: button.closest("[data-entered]")?.getAttribute("data-entered") ?? null,
      transform: getComputedStyle(button.querySelector("svg")!.parentElement!).transform,
    };
  });
  expect(state.entered).toBe("true");
  expect(state.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
});

for (const closeWith of ["button", "Escape"] as const) {
  test(`assistant resumes walking after closing chat with ${closeWith}`, async ({ screen, browser }) => {
    const assistant = screen.getByRole("button", "和像素助手聊聊", { exact: false });
    await assistant.tap();
    await expect(screen.getByRole("dialog", "问一问", { exact: false })).toBeVisible();
    if (closeWith === "button") {
      await screen.getByRole("button", "关闭问一问", { exact: false }).tap();
    } else {
      await browser.mouse.move(0, 0);
      await browser.keyboard.press("Escape");
    }
    await expect(assistant).toBeDisabled();
    const initialEntry = await browser.evaluate(() => {
      const button = document.querySelector('[aria-label="和像素助手聊聊"]') as HTMLButtonElement;
      return {
        entered: button.closest("[data-entered]")?.getAttribute("data-entered") ?? null,
        position: new DOMMatrixReadOnly(getComputedStyle(button.parentElement!).transform).toFloat64Array().slice(12, 14).join(","),
      };
    });
    expect(initialEntry.entered).toBe("false");
    expect(initialEntry.position.split(",").every((value) => Math.abs(Number(value)) < 1)).toBe(true);
    await expect(screen.getByRole("dialog", "问一问", { exact: false })).toBeHidden();
    await expect(assistant).toBeEnabled();
    await expect(assistant).toBeFocused();
    const walker = browser.locator("xpath=//*[@aria-label='和像素助手聊聊']/..");
    await expect.poll(() => browser.evaluate(() =>
      document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!.getAnimations().some((animation) => animation.playState === "running"),
    ), { timeout: 3000 }).toBe(true);
    const before = await walker.boundingBox();
    await expect.poll(async () => {
      const after = await walker.boundingBox();
      return Math.hypot(after!.x - before!.x, after!.y - before!.y);
    }, { timeout: 3000 }).toBeGreaterThan(2);
  });
}
