import type { Browser } from "@e2e-dev/web";
import { expect, test } from "./helpers/loader-key.ts";
import { openAssistant } from "./helpers/assistant.ts";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { emitAsk, installEmitAskMock } from "./helpers/ask-stream.ts";

// browser.evaluate 必须返回 JSON；页面内定时器复现 waitForTimeout 的固定静置窗口，
// 供「这段时间内不再发生过渡/动画」的负向断言使用。
function settle(browser: Browser, milliseconds: number) {
  return browser.evaluate((duration: number) => new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), duration);
  }), milliseconds);
}

// 键盘激活（Enter，合成 click detail 为 0）直接到达开合终态：本次切换零过渡事件；
// 指针开合仍走 chevron 旋转与引用淡入过渡。
test("sources disclosure toggles instantly from the keyboard and transitions from the mouse", async ({ app, screen, browser }) => {
  await installEmitAskMock(browser);

  const dialog = await openAssistant(app, screen, browser);
  await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("请整理公开资料");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  await emitAsk(browser, "text", { delta: "root = TextContent(\"结论已整理\")" });
  await emitAsk(browser, "sources", { sources: [{ id: "source-1", title: "测试公开来源", sourceUrl: "/curation/source" }] });
  await emitAsk(browser, "done", {});
  const summary = browser.locator('[role="dialog"] summary').filter({ hasText: "参考资料 · 1 篇" });
  await expect(summary).toBeVisible();
  const details = browser.locator('xpath=//*[@role="dialog"]//summary[contains(normalize-space(.), "参考资料 · 1 篇")]/ancestor::details[1]');
  const citations = dialog.getByRole("list", "回答来源", { exact: false });
  await browser.evaluate(() => {
    const w = window as typeof window & { __sourceTransitions: string[] };
    w.__sourceTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("details")) w.__sourceTransitions.push((event as TransitionEvent).propertyName);
    });
    return null;
  });
  const readTransitions = () => browser.evaluate(() => (
    window as typeof window & { __sourceTransitions?: string[] }
  ).__sourceTransitions ?? []);

  await summary.tap();
  await expect(citations).toBeVisible();
  await expect.poll(readTransitions).toContain("transform");
  expect(await details.getAttribute("data-instant")).toBeNull();
  const transitionsAfterMouseOpen = await readTransitions();

  await summary.focus();
  await browser.keyboard.press("Enter");
  await expect(citations).toBeHidden();
  expect(await browser.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('[role="dialog"] summary'))
      .filter((element) => element.textContent?.includes("参考资料 · 1 篇"));
    if (summaries.length !== 1) throw new Error(`expected exactly one sources summary, found ${summaries.length}`);
    const detailsElement = summaries[0].closest("details");
    if (!detailsElement) throw new Error("sources summary has no details ancestor");
    return (detailsElement as HTMLDetailsElement).open;
  })).toBe(false);
  expect(await details.getAttribute("data-instant")).toBe("");
  expect(await browser.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('[role="dialog"] summary'))
      .filter((element) => element.textContent?.includes("参考资料 · 1 篇"));
    if (summaries.length !== 1) throw new Error(`expected exactly one sources summary, found ${summaries.length}`);
    const chevrons = summaries[0].querySelectorAll("svg");
    if (chevrons.length !== 1) throw new Error(`expected exactly one summary chevron svg, found ${chevrons.length}`);
    return getComputedStyle(chevrons[0]).transitionProperty;
  })).toBe("none");
  await settle(browser, 300);
  expect(await readTransitions()).toEqual(transitionsAfterMouseOpen);
});

test("Ask retrieval status uses Motion with a static reduced state", async ({ app, screen, browser }) => {
  let releaseResponse!: () => void;
  let responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await browser.route("**/api/ask", async (route) => {
    await responseGate;
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  // 前置条件调整（非等价）：旧用例在「打开抽屉、确认输入框、聚焦」之后 waitForLoadState("networkidle")；
  // 框架没有 waitForLoadState（迁移文档标 missing），networkidle 只能挂在 browser.goto 导航本身。
  // 旧等的是抽屉打开后的网络静置，新等的只是导航期静置：发送阶段不再有「网络已静置」这一前置，
  // 可能与后续网络活动或入场动画重叠，状态图标 animationName/opacity 现读断言在此前提下成立。
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await browser.goto("/curation", { waitUntil: "networkidle" });
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();

  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.focus();
  await input.fill("测试检索状态");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  const statusIcon = browser.locator('[role="dialog"] [role="status"] svg');
  await expect(statusIcon).toBeVisible();
  // 旧版链是 page.getByRole("status").locator("svg")（页面作用域 + 单匹配），页内读取同语义复现。
  expect(await browser.evaluate(() => {
    const icons = document.querySelectorAll('[role="status"] svg');
    if (icons.length !== 1) throw new Error(`expected exactly one status icon, found ${icons.length}`);
    return getComputedStyle(icons[0]).animationName;
  })).toBe("none");
  releaseResponse();
  await expect(statusIcon).toBeHidden();

  await emulateReducedMotion(browser);
  await openAssistant(app, screen, browser);
  responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const reducedInput = dialog.getByRole("textbox", "输入问题", { exact: false });
  await reducedInput.fill("测试减少动态");
  const reducedSend = dialog.getByRole("button", "发送问题", { exact: false });
  await expect(reducedSend).toBeEnabled();
  await reducedSend.tap();
  // 框架没有 toHaveCSS：opacity 轮询读 computed style（reduce 下 framer-motion 静态置 1）。
  // 单匹配校验抛错在 expect.poll 里按失败读重试，marker 未渲染前的零匹配不会立即失败。
  const readStatusOpacity = () => browser.evaluate(() => {
    const icons = document.querySelectorAll('[role="status"] svg');
    if (icons.length !== 1) throw new Error(`expected exactly one status icon, found ${icons.length}`);
    return getComputedStyle(icons[0]).opacity;
  });
  await expect.poll(readStatusOpacity).toBe("1");
  await settle(browser, 300);
  await expect.poll(readStatusOpacity).toBe("1");
  releaseResponse();
});

test("assistant drawer sends without delaying the request", async ({ screen, browser }) => {
  await browser.route("**/api/ask", async (route) => {
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  // 前置条件调整（同上一例）：旧用例在抽屉打开、输入框聚焦后再 waitForLoadState("networkidle")，
  // 然后才注入计时钩子；框架只能在 browser.goto 导航期等 networkidle，开抽屉在其后。未保留打开
  // 抽屉后的网络静置窗口，click→fetch 计时可能与后续网络活动或入场动画重叠；该用例证的正是
  // 这些进行中的活动不把 fetch 推迟过 300ms。
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await browser.goto("/curation", { waitUntil: "networkidle" });
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();
  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.focus();
  await input.fill("请概括你的工程实践");

  await browser.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming: { clickAt: number; fetchAt: number };
    };
    const nativeFetch = window.fetch.bind(window);
    testWindow.__askMotionTiming = { clickAt: 0, fetchAt: 0 };
    window.fetch = (...args) => {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      if (url.includes("/api/ask")) testWindow.__askMotionTiming.fetchAt = performance.now();
      return nativeFetch(...args);
    };
    document.querySelector('button[aria-label="发送问题"]')?.addEventListener("click", () => {
      testWindow.__askMotionTiming.clickAt = performance.now();
    }, { capture: true, once: true });
    return null;
  });

  await screen.getByRole("button", "发送问题", { exact: false }).tap();
  await expect.poll(() => browser.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming?: { clickAt: number; fetchAt: number };
    };
    const timing = testWindow.__askMotionTiming;
    // Infinity 过不了 JSON 序列化；大数哨兵保住「fetch 未发生前一直轮询」的语义。
    return timing?.fetchAt ? timing.fetchAt - timing.clickAt : 1e9;
  })).toBeLessThan(300);
});

test("Ask can return to the latest message after reading earlier messages", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:ask-chat", JSON.stringify({
    messages: Array.from({ length: 12 }, (_, index) => ({
      citations: [], content: `第 ${index + 1} 条问题。${"内容 ".repeat(80)}`,
      id: `message-${index}`, isComplete: true, role: "user",
    })),
    question: "",
  })));
  const dialog = await openAssistant(app, screen, browser);
  // 滚动容器复现旧版 dialog.getByRole("region", { name: "问答记录" }) 的契约：dialog 作用域 +
  // region 语义（Viewport 渲染显式 role="region"）+ 单匹配；框架没有 locator.evaluate，
  // 三处读取在页面内 querySelectorAll 恰好一个、不唯一即 throw。
  const button = dialog.getByRole("button", "回到最新消息", { exact: false });
  await expect.poll(() => browser.evaluate(() => {
    const regions = Array.from(document.querySelectorAll('[role="region"][aria-label="问答记录"]'))
      .filter((element) => element.closest('[role="dialog"]'));
    if (regions.length !== 1) throw new Error(`expected exactly one 问答记录 region, found ${regions.length}`);
    return regions[0].scrollHeight > regions[0].clientHeight;
  })).toBe(true);
  await browser.evaluate(() => {
    const regions = Array.from(document.querySelectorAll('[role="region"][aria-label="问答记录"]'))
      .filter((element) => element.closest('[role="dialog"]'));
    if (regions.length !== 1) throw new Error(`expected exactly one 问答记录 region, found ${regions.length}`);
    regions[0].scrollTop = 0;
    return null;
  });
  await expect(button).toHaveAttribute("data-active", "true");
  await button.tap();
  await expect.poll(() => browser.evaluate(() => {
    const regions = Array.from(document.querySelectorAll('[role="region"][aria-label="问答记录"]'))
      .filter((element) => element.closest('[role="dialog"]'));
    if (regions.length !== 1) throw new Error(`expected exactly one 问答记录 region, found ${regions.length}`);
    return regions[0].scrollHeight - regions[0].clientHeight - regions[0].scrollTop;
  })).toBeLessThan(2);
});


test("Ask has no automatically detectable accessibility violations", async ({ app, screen, browser }) => {
  // AxeBuilder 绑定 Playwright Page；注入同版本 axe-core 在页面内跑同一默认规则集，
  // include('[role="dialog"]') 的语义等价转成 axe.run 的 context 选择器参数。
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  await openAssistant(app, screen, browser);
  const violations = await browser.evaluate(() => {
    const axe = (window as typeof window & {
      axe?: { run: (context: unknown) => Promise<{ violations: { id: string }[] }> };
    }).axe;
    if (!axe) throw new Error("axe-core init script 未注入");
    return axe.run('[role="dialog"]').then((results) => results.violations);
  });
  expect(violations).toEqual([]);
});
