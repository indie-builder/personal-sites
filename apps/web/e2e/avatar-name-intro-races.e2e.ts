import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { readAvatarMeta, readCanvasDigest } from "./helpers/avatar.ts";
import { gridDistance, readCenter, renderGlyphReference } from "./helpers/avatar-glyph.ts";

const CENTER_MIN = 0.03;

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
  // TanStack 下 runner 的 open 要等整个开演仪式落定才返回，leaving 相在 open 期间
  // 就结束了。清掉会话标记原地重放一次仪式，让下面的 poll 在重放期间捕捉离场相。
  await browser.evaluate(() => {
    sessionStorage.clear();
    location.reload();
    return null;
  });
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
  // 中止后不再开演名字：直接落到头像成像终态。
  await expect.poll(() => readCenter(browser), { timeout: 15_000 }).toBeGreaterThan(CENTER_MIN);
  // 之后画面稳定在头像：迟到的 reveal/字形回调不得再开演成字。
  const first = await readCenter(browser);
  await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
  const second = await readCenter(browser);
  expect(first!).toBeGreaterThan(CENTER_MIN);
  expect(second!).toBeGreaterThan(CENTER_MIN);
  expect(Math.abs(second! - first!)).toBeLessThan(1e-3);
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

// P2 竞态：首访字形采样被扣在 fonts.load 上，等用户已取消开场并用键盘
// 定格新的静态彩蛋之后才放行。迟到的采样回调不得覆盖已定格的形：形名与
// 真实像素都原样保留，下一次激活仍正常回到头像。
test("a late first-visit glyph load must not overwrite a newly settled static form", async ({ app, browser }) => {
  await browser.addInitScript(() => {
    const w = window as typeof window & {
      __fontsArmed?: boolean;
      __fontsDone?: number;
      __fontsStarted?: number;
      __releaseFonts?: () => void;
    };
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    w.__releaseFonts = release;
    let started = 0;
    let done = 0;
    const fonts = document.fonts;
    const orig = fonts.load.bind(fonts);
    fonts.load = ((...args: Parameters<typeof orig>) => {
      started += 1;
      w.__fontsStarted = started;
      return gate
        .then(() => orig(...args))
        .then((faces) => {
          done += 1;
          w.__fontsDone = done;
          return faces;
        });
    }) as typeof orig;
    // 拦截未武装（字体集不可改写等）必须显式失败，不允许退化成普通首访。
    w.__fontsArmed = true;
  });
  await app.clearState();
  await app.open("/");
  // 与上一用例同理：open 会等仪式落定，清标记原地重放，让字形采样的竞态发生在
  // 观察窗内。重放后 init script 重新安装，武装标记与字体门闸仍然生效。
  await browser.evaluate(() => {
    sessionStorage.clear();
    location.reload();
    return null;
  });
  await expect
    .poll(async () => {
      try {
        return await browser.evaluate(
          () => (window as typeof window & { __fontsArmed?: boolean }).__fontsArmed === true
            && document.readyState === "complete",
        );
      } catch {
        // location.reload 进行中，evaluate 的执行上下文暂时不可用，下一轮重试。
        return false;
      }
    }, { timeout: 15_000 })
    .toBe(true);
  // 粒子接管且首字的 load 确实被扣住（全站只有序列采样调用 fonts.load）。
  await expect.poll(() => browser.evaluate(() => ({
    particles: document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.dataset.particles === "on",
    started: (window as typeof window & { __fontsStarted?: number }).__fontsStarted ?? 0,
  })), { timeout: 20_000 }).toEqual({ particles: true, started: 1 });
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 15_000 });
  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".curation-home__avatar")?.focus();
    return true;
  });
  await browser.keyboard.press("Enter");
  await expect.poll(async () => {
    const meta = await readAvatarMeta(browser);
    return meta !== null && meta.state === "idle" && meta.shape === "portrait";
  }, { timeout: 5_000 }).toBe(true);
  const portraitDigest = await readCanvasDigest(browser);
  expect(portraitDigest).not.toBeNull();
  await browser.keyboard.press("Enter");
  await expect.poll(async () => {
    const meta = await readAvatarMeta(browser);
    return meta !== null && meta.state === "static" && meta.shape === "mascot";
  }, { timeout: 5_000 }).toBe(true);
  const held = await readAvatarMeta(browser);
  const heldDigest = await readCanvasDigest(browser);
  expect(heldDigest).not.toBeNull();
  await browser.evaluate(() => {
    (window as typeof window & { __releaseFonts?: () => void }).__releaseFonts?.();
    return true;
  });
  // 名字两字串行采样：第二字的 load 在第一字放行后才发起，只看完成数会在
  // 两字之间误判完成；发起数含第二字且与完成数追平，迟到回调链才算走完。
  await expect.poll(() => browser.evaluate(() => {
    const w = window as typeof window & { __fontsDone?: number; __fontsStarted?: number };
    const started = w.__fontsStarted ?? 0;
    return started >= 2 && (w.__fontsDone ?? 0) === started;
  }), { timeout: 15_000 }).toBe(true);
  // 迟到分支的 setView 经 React 调度提交：过两帧再读，覆盖（若存在）已落定。
  await browser.evaluate(() => new Promise<boolean>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  }));
  const retained = await readAvatarMeta(browser);
  expect(retained).toMatchObject({ shape: held?.shape, state: "static" });
  expect(await readCanvasDigest(browser)).toBe(heldDigest);
  await browser.keyboard.press("Enter");
  await expect.poll(async () => {
    const meta = await readAvatarMeta(browser);
    return meta !== null && meta.state === "idle" && meta.shape === "portrait";
  }, { timeout: 5_000 }).toBe(true);
  expect(await readCanvasDigest(browser)).toBe(portraitDigest);
});
