import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openAssistant } from "./helpers/assistant.playwright";

// 键盘激活（Enter，合成 click detail 为 0）直接到达开合终态：本次切换零过渡事件；
// 指针开合仍走 chevron 旋转与引用淡入过渡。
test("sources disclosure toggles instantly from the keyboard and transitions from the mouse", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const controls = window as typeof window & { emitAsk: (event: string, data: unknown) => void };
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.endsWith("/api/ask")) return originalFetch(input, init);
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controls.emitAsk = (event, data) => {
            controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            if (event === "done") controller.close();
          };
        },
      }), { headers: { "Content-Type": "text/event-stream" } }));
    };
  });
  const emit = (event: string, data: unknown) => page.evaluate(({ event, data }) => {
    (window as typeof window & { emitAsk: (event: string, data: unknown) => void }).emitAsk(event, data);
  }, { event, data });

  const dialog = await openAssistant(page);
  await dialog.getByRole("textbox", { name: "输入问题" }).fill("请整理公开资料");
  await dialog.getByRole("button", { name: "发送问题" }).click();
  await emit("text", { delta: "root = TextContent(\"结论已整理\")" });
  await emit("sources", { sources: [{ id: "source-1", title: "测试公开来源", sourceUrl: "/curation/source" }] });
  await emit("done", {});
  const summary = dialog.locator("summary").filter({ hasText: "参考资料 · 1 篇" });
  await expect(summary).toBeVisible();
  const details = summary.locator("xpath=ancestor::details[1]");
  const citations = dialog.getByRole("list", { name: "回答来源" });
  const chevron = summary.locator("svg");
  await page.evaluate(() => {
    const w = window as typeof window & { __sourceTransitions: string[] };
    w.__sourceTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("details")) w.__sourceTransitions.push((event as TransitionEvent).propertyName);
    });
  });
  const readTransitions = () => page.evaluate(() => (
    window as typeof window & { __sourceTransitions?: string[] }
  ).__sourceTransitions ?? []);

  await summary.click();
  await expect(citations).toBeVisible();
  await expect.poll(readTransitions).toContain("transform");
  expect(await details.getAttribute("data-instant")).toBeNull();
  const transitionsAfterMouseOpen = await readTransitions();

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(citations).toBeHidden();
  expect(await details.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
  expect(await details.getAttribute("data-instant")).toBe("");
  expect(await chevron.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
  await page.waitForTimeout(300);
  expect(await readTransitions()).toEqual(transitionsAfterMouseOpen);
});

test("Ask retrieval status uses Motion with a static reduced state", async ({ page }) => {
  let releaseResponse!: () => void;
  let responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/ask", async (route) => {
    await responseGate;
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "输入问题" });
  await input.focus();
  await page.waitForLoadState("networkidle");
  await input.fill("测试检索状态");
  await page.getByRole("button", { name: "发送问题" }).click();
  const statusIcon = page.getByRole("status").locator("svg");
  await expect(statusIcon).toBeVisible();
  expect(await statusIcon.evaluate((icon) => getComputedStyle(icon).animationName)).toBe("none");
  releaseResponse();
  await expect(statusIcon).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAssistant(page);
  responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const reducedInput = page.getByRole("textbox", { name: "输入问题" });
  await reducedInput.fill("测试减少动态");
  const reducedSend = page.getByRole("button", { name: "发送问题" });
  await expect(reducedSend).toBeEnabled();
  await reducedSend.click();
  const reducedStatusIcon = page.getByRole("status").locator("svg");
  await expect(reducedStatusIcon).toHaveCSS("opacity", "1");
  await page.waitForTimeout(300);
  await expect(reducedStatusIcon).toHaveCSS("opacity", "1");
  releaseResponse();
});

test("assistant drawer sends without delaying the request", async ({ page }) => {
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await openAssistant(page);
  const input = page.getByRole("textbox", { name: "输入问题" });
  await input.focus();
  await page.waitForLoadState("networkidle");
  await input.fill("请概括你的工程实践");

  await page.evaluate(() => {
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
  });

  await page.getByRole("button", { name: "发送问题" }).click();
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming?: { clickAt: number; fetchAt: number };
    };
    const timing = testWindow.__askMotionTiming;
    return timing?.fetchAt ? timing.fetchAt - timing.clickAt : Infinity;
  })).toBeLessThan(300);
});

test("Ask can return to the latest message after reading earlier messages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("personal-site:ask-chat", JSON.stringify({
    messages: Array.from({ length: 12 }, (_, index) => ({
      citations: [], content: `第 ${index + 1} 条问题。${"内容 ".repeat(80)}`,
      id: `message-${index}`, isComplete: true, role: "user",
    })),
    question: "",
  })));
  const dialog = await openAssistant(page);
  const viewport = dialog.getByRole("region", { name: "问答记录" });
  const button = dialog.getByRole("button", { name: "回到最新消息" });
  await expect.poll(() => viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await viewport.evaluate((element) => { element.scrollTop = 0; });
  await expect(button).toHaveAttribute("data-active", "true");
  await button.click();
  await expect.poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 812 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`Ask streams default OpenUI components before citations at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      const controls = window as typeof window & { emitAsk: (event: string, data: unknown) => void };
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.endsWith("/api/ask")) return originalFetch(input, init);
        return Promise.resolve(new Response(new ReadableStream({
          start(controller) {
            controls.emitAsk = (event, data) => {
              controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
              if (event === "done") controller.close();
            };
          },
        }), { headers: { "Content-Type": "text/event-stream" } }));
      };
    });
    const dialog = await openAssistant(page);
    await dialog.getByRole("textbox", { name: "输入问题" }).fill("请整理公开资料");
    await dialog.getByRole("button", { name: "发送问题" }).click();
    await expect(dialog.getByRole("button", { name: "停止生成" })).toBeVisible();
    const emit = (event: string, data: unknown) => page.evaluate(({ event, data }) => {
      (window as typeof window & { emitAsk: (event: string, data: unknown) => void }).emitAsk(event, data);
    }, { event, data });
    await emit("text", { delta: `root = Stack([TextContent(${JSON.stringify("## 资料概览\n\n先看**工程实践**。\n\n- 连续阅读\n- 来源可追溯\n\n```ts\nconst ready = true;\n```")}), Tabs([TabItem("overview", "摘要", [TextContent("先看概览")]), TabItem("details", "详细内容", [TextContent("这里是详细说明")])])` });
    await expect(dialog.getByRole("heading", { name: "资料概览" })).toBeVisible();
    await expect(dialog.locator("strong")).toHaveText("工程实践");
    await expect(dialog.locator(".ask-openui ul")).toHaveCSS("list-style-type", "disc");
    await expect(dialog.locator(".ask-openui p").first()).toHaveCSS("font-size", "13px");
    await emit("sources", { sources: [{ id: "source-1", title: "测试公开来源", sourceUrl: "/curation/source" }] });
    await expect(dialog.getByRole("list", { name: "回答来源" })).toHaveCount(0);
    await emit("done", {});
    await dialog.getByRole("tab", { name: "详细内容" }).click();
    await expect(dialog.getByText("这里是详细说明")).toBeVisible();
    const sourcesToggle = dialog.locator("summary").filter({ hasText: "参考资料 · 1 篇" });
    await expect(sourcesToggle).toBeVisible();
    await expect(dialog.getByRole("list", { name: "回答来源" })).toBeHidden();
    await sourcesToggle.click();
    await expect(dialog.getByRole("list", { name: "回答来源" })).toBeVisible();
    await sourcesToggle.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("list", { name: "回答来源" })).toBeHidden();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (viewport.width <= 900) await expect(dialog.getByRole("textbox")).toHaveCSS("font-size", "16px");
  });
}

test("Ask has no automatically detectable accessibility violations", async ({ page }) => {
  await openAssistant(page);
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations).toEqual([]);
});
