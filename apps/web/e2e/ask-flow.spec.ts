import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openAssistant } from "./helpers/assistant";

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

test("Ask has no automatically detectable accessibility violations", async ({ page }) => {
  await openAssistant(page);
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations).toEqual([]);
});
