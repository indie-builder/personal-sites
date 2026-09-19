import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("drawer matches reference composer and greeting alignment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/curation");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  const dialog = page.getByRole("dialog", { name: "问一问" });
  await expect(dialog.getByRole("textbox", { name: "输入问题" })).toBeFocused();
  const layout = await dialog.evaluate((root) => {
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
  await expect(dialog.getByRole("button", { name: /检索范围/ })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("drawer-desktop.png") });
  await expect(page.locator(".curation-home__profile")).toBeHidden();
  await expect(page.locator(".curation-home__feed")).toBeVisible();
  await dialog.getByRole("button", { name: "关闭问一问" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".curation-home__profile")).toBeVisible();
  await expect(page.getByRole("button", { name: "和像素助手聊聊" })).toBeFocused();
});

test("drawer keeps mobile input readable, restores drafts and renders replies", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  const dialog = page.getByRole("dialog", { name: "问一问" });
  const input = dialog.getByRole("textbox", { name: "输入问题" });
  await input.fill("你的工程经历是什么？");
  expect(await input.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  await expect(input).toHaveValue("你的工程经历是什么？");
  await page.route("**/api/ask", async (route) => {
    expect(route.request().postDataJSON().scope).toBe("all");
    await route.fulfill({ contentType: "text/event-stream", body: 'event: text\ndata: {"delta":"这是一条用于验证布局的回答。"}\n\nevent: done\ndata: {}\n\n' });
  });
  await dialog.getByRole("button", { name: "发送问题" }).click();
  await expect(dialog.getByText("这是一条用于验证布局的回答。")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "发送问题" })).toBeDisabled();
  const bounds = await input.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(18);
  expect(bounds!.y + bounds!.height).toBeLessThan(812);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: test.info().outputPath("drawer-mobile.png") });
});

test("drawer transitions do not resize the page on every animation frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/curation");
  await expect(page.getByRole("button", { name: "和像素助手聊聊" })).toBeEnabled();
  const openingWidths = page.evaluate(() => new Promise<number[]>((resolve) => {
    const widths = new Set<number>();
    const canvas = document.getElementById("site-canvas")!;
    const observer = new ResizeObserver(() => widths.add(Math.round(canvas.getBoundingClientRect().width)));
    observer.observe(canvas);
    setTimeout(() => { observer.disconnect(); resolve([...widths]); }, 1600);
  }));
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  expect((await openingWidths).length).toBeLessThanOrEqual(2);
  const closingWidths = page.evaluate(() => new Promise<number[]>((resolve) => {
    const widths = new Set<number>();
    const canvas = document.getElementById("site-canvas")!;
    const observer = new ResizeObserver(() => widths.add(Math.round(canvas.getBoundingClientRect().width)));
    observer.observe(canvas);
    setTimeout(() => { observer.disconnect(); resolve([...widths]); }, 900);
  }));
  await page.getByRole("button", { name: "关闭问一问" }).click();
  expect((await closingWidths).length).toBeLessThanOrEqual(2);
  await expect(page.locator(".curation-home__profile")).toBeVisible();
  await expect(page.getByRole("button", { name: "和像素助手聊聊" })).toBeFocused();
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  await page.getByRole("button", { name: "关闭问一问" }).click();
  await expect(page.getByRole("dialog", { name: "问一问" })).toBeHidden();
  await expect(page.locator(".curation-home__profile")).toBeVisible();
  expect(await page.locator(".curation-home__feed").evaluate((element) => element.style.willChange)).toBe("");
  expect(await page.evaluate(() => document.body.dataset.assistantOpen)).toBeUndefined();
});

test("mobile drawer is modal: focus stays inside the full-screen panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  const dialog = page.getByRole("dialog", { name: "问一问" });
  await expect(dialog.getByRole("textbox", { name: "输入问题" })).toBeVisible();
  // 全屏覆盖层必须标注模态，否则读屏会继续暴露被遮住的背景内容。
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  // 连续后移焦点（起点为面板当前聚焦元素），焦点应圈闭在面板内，不会落到背景页面。
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("Shift+Tab");
  const focusInside = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"][aria-modal="true"]')),
  );
  expect(focusInside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "和像素助手聊聊" })).toBeFocused();
});

test("mobile modal drawer survives the animated close path", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "和像素助手聊聊" }).click();
  const dialog = page.getByRole("dialog", { name: "问一问" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("textbox", { name: "输入问题" })).toBeVisible();

  // 带 450ms 关闭动画的真实模态生命周期：背景屏蔽随关闭解除，焦点回到触发按钮。
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "和像素助手聊聊" })).toBeFocused();
  expect(await page.evaluate(() => document.body.dataset.assistantOpen)).toBeUndefined();
  const backgroundHidden = await page.evaluate(() =>
    [...document.querySelectorAll("body > div")].some((node) => node.getAttribute("aria-hidden") === "true"),
  );
  expect(backgroundHidden).toBe(false);
});
