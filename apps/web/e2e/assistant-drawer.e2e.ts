import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { expect, test } from "./helpers/loader-key.ts";

test("drawer matches reference composer and greeting alignment", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  await browser.setViewport({ height: 900, width: 1440 });
  await app.open("/curation");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeFocused();
  // 框架无 locator.evaluate：页面内唯一的 [role="dialog"] 即旧 dialog 定位，测量代码逐字保留。
  const layout = await browser.evaluate(() => {
    const root = document.querySelector('[role="dialog"]')!;
    const composer = root.querySelector("[data-ask-composer]")!;
    const send = root.querySelector('[aria-label="发送问题"]')!;
    const greeting = root.querySelector('[data-slot="empty"] p')!;
    const track = greeting.previousElementSibling!;
    const text = greeting.getBoundingClientRect();
    const rail = track.getBoundingClientRect();
    return {
      width: root.getBoundingClientRect().width,
      composer: composer.getBoundingClientRect().toJSON(),
      send: send.getBoundingClientRect().toJSON(),
      radius: getComputedStyle(send).borderRadius,
      trackDelta: Math.abs(rail.width - text.width),
      alignment: Math.abs(rail.x - text.x),
      gap: text.top - rail.bottom,
    };
  });
  expect(layout.width).toBe(420);
  // 桌面侧板保持非模态：背景仍可交互（显式渲染 aria-modal="false"）。
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  expect(layout.composer.width).toBe(384);
  expect(layout.composer.height).toBe(84);
  expect(layout.composer.bottom).toBe(882);
  expect(layout.send.width).toBe(30);
  expect(layout.send.height).toBe(30);
  expect(layout.radius).toBe("50%");
  expect(layout.trackDelta).toBeLessThan(1);
  expect(layout.alignment).toBeLessThan(1);
  expect(layout.gap).toBe(10);
  await expect(dialog.getByRole("button", /检索范围/)).toHaveCount(0);
  // 框架无 test.info().outputPath：截图改为挂到报告工件。
  await app.screenshot("drawer-desktop");
  await expect(browser.locator(".curation-home__profile")).toBeHidden();
  await expect(browser.locator(".curation-home__feed")).toBeVisible();
  await dialog.getByRole("button", "关闭问一问", { exact: false }).tap();
  await expect(dialog).toBeHidden();
  await expect(browser.locator(".curation-home__profile")).toBeVisible();
  await expect(screen.getByRole("button", "和像素助手聊聊", { exact: false })).toBeFocused();
});

test("drawer keeps mobile input readable, restores drafts and renders replies", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  await browser.setViewport({ height: 812, width: 320 });
  await app.open("/");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.fill("你的工程经历是什么？");
  expect(await browser.evaluate(() => getComputedStyle(document.querySelector("[data-ask-composer] textarea")!).fontSize)).toBe("16px");
  await browser.keyboard.press("Escape");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  await expect(input).toHaveValue("你的工程经历是什么？");
  // 框架的 request.postData 只有字符串：请求体在 handler 内自行解析。
  await browser.route("**/api/ask", async (route) => {
    expect(JSON.parse(route.request.postData ?? "").scope).toBe("all");
    await route.fulfill({ contentType: "text/event-stream", body: `event: text\ndata: ${JSON.stringify({ delta: 'root = Stack([TextContent("这是一条用于验证布局的回答。")])' })}\n\nevent: done\ndata: {}\n\n` });
  });
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  await expect(dialog.getByText("这是一条用于验证布局的回答。", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", "发送问题", { exact: false })).toBeDisabled();
  const bounds = await input.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(18);
  expect(bounds!.y + bounds!.height).toBeLessThan(812);
  expect(await browser.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await app.screenshot("drawer-mobile");
});

test("drawer keeps the same model conversation after closing and reopening", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  const conversationIds: string[] = [];
  const visitorIds: string[] = [];
  await browser.route("**/api/ask", async (route) => {
    const body = JSON.parse(route.request.postData ?? "");
    conversationIds.push(body.conversationId);
    visitorIds.push(body.visitorId);
    await route.fulfill({ contentType: "text/event-stream", body: `event: text\ndata: ${JSON.stringify({ delta: 'root = Stack([TextContent("已根据公开资料回答。")])' })}\n\nevent: done\ndata: {}\n\n` });
  });
  await app.open("/curation");
  for (const question of ["先介绍你的工程经历", "刚才的经历里有什么重点"]) {
    await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
    const dialog = screen.getByRole("dialog", "问一问", { exact: false });
    await dialog.getByRole("textbox", "输入问题", { exact: false }).fill(question);
    await dialog.getByRole("button", "发送问题", { exact: false }).tap();
    await expect(dialog.getByText("已根据公开资料回答。", { exact: false }).last()).toBeVisible();
    await dialog.getByRole("button", "关闭问一问", { exact: false }).tap();
    await expect(dialog).toBeHidden();
  }
  expect(conversationIds).toHaveLength(2);
  expect(conversationIds[1]).toBe(conversationIds[0]);
  expect(visitorIds[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(visitorIds[1]).toBe(visitorIds[0]);
  expect(conversationIds[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(visitorIds[0]).not.toBe(conversationIds[0]);
});

test("drawer transitions do not resize the page on every animation frame", async ({ app, screen, browser }) => {
  // 旧用例在此显式切回 no-preference：本引擎不模拟 reduced-motion，不注册补丁即真实动画路径。
  await browser.setViewport({ height: 900, width: 1440 });
  await app.open("/curation");
  const assistant = screen.getByRole("button", "和像素助手聊聊", { exact: false });
  await expect(assistant).toBeEnabled();
  // 观察窗必须先于点击装好：evaluate 不立即 await，页面内 1600ms 采样才能覆盖点击后的过渡。
  const openingWidths = browser.evaluate(() => new Promise<number[]>((resolve) => {
    const widths = new Set<number>();
    const canvas = document.getElementById("site-canvas")!;
    const observer = new ResizeObserver(() => widths.add(Math.round(canvas.getBoundingClientRect().width)));
    observer.observe(canvas);
    setTimeout(() => { observer.disconnect(); resolve([...widths]); }, 1600);
  }));
  await assistant.tap();
  expect((await openingWidths).length).toBeLessThanOrEqual(2);
  const closingWidths = browser.evaluate(() => new Promise<number[]>((resolve) => {
    const widths = new Set<number>();
    const canvas = document.getElementById("site-canvas")!;
    const observer = new ResizeObserver(() => widths.add(Math.round(canvas.getBoundingClientRect().width)));
    observer.observe(canvas);
    setTimeout(() => { observer.disconnect(); resolve([...widths]); }, 900);
  }));
  await screen.getByRole("button", "关闭问一问", { exact: false }).tap();
  expect((await closingWidths).length).toBeLessThanOrEqual(2);
  await expect(browser.locator(".curation-home__profile")).toBeVisible();
  await expect(assistant).toBeFocused();
  await assistant.tap();
  await screen.getByRole("button", "关闭问一问", { exact: false }).tap();
  await expect(screen.getByRole("dialog", "问一问", { exact: false })).toBeHidden();
  await expect(browser.locator(".curation-home__profile")).toBeVisible();
  expect(await browser.evaluate(() => (document.querySelector(".curation-home__feed") as HTMLElement).style.willChange)).toBe("");
  // evaluate 返回值必须 JSON：dataset 缺失的 undefined 落回 null，断言等价的「无此标记」。
  expect(await browser.evaluate(() => document.body.dataset.assistantOpen ?? null)).toBeNull();
});

test("mobile drawer is modal: focus stays inside the full-screen panel", async ({ app, screen, browser }) => {
  await emulateReducedMotion(browser);
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();
  // 全屏覆盖层必须标注模态，否则读屏会继续暴露被遮住的背景内容。
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  // 连续后移焦点（起点为面板当前聚焦元素），焦点应圈闭在面板内，不会落到背景页面。
  for (let i = 0; i < 12; i += 1) await browser.keyboard.press("Shift+Tab");
  const focusInside = await browser.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"][aria-modal="true"]')),
  );
  expect(focusInside).toBe(true);

  await browser.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(screen.getByRole("button", "和像素助手聊聊", { exact: false })).toBeFocused();
});

test("mobile modal drawer survives the animated close path", async ({ app, screen, browser }) => {
  // 旧用例显式 no-preference 才走真实关闭动画：不注册 reduce 补丁即该路径。
  await browser.setViewport({ height: 844, width: 390 });
  await app.open("/");
  await screen.getByRole("button", "和像素助手聊聊", { exact: false }).tap();
  const dialog = screen.getByRole("dialog", "问一问", { exact: false });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("textbox", "输入问题", { exact: false })).toBeVisible();

  // 带 450ms 关闭动画的真实模态生命周期：背景屏蔽随关闭解除，焦点回到触发按钮。
  await browser.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(screen.getByRole("button", "和像素助手聊聊", { exact: false })).toBeFocused();
  expect(await browser.evaluate(() => document.body.dataset.assistantOpen ?? null)).toBeNull();
  const backgroundHidden = await browser.evaluate(() =>
    [...document.querySelectorAll("body > div")].some((node) => node.getAttribute("aria-hidden") === "true"),
  );
  expect(backgroundHidden).toBe(false);
});
