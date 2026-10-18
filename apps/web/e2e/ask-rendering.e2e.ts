import { expect, test } from "./helpers/loader-key.ts";
import { openAssistant } from "./helpers/assistant.ts";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";
import { emitAsk, installEmitAskMock } from "./helpers/ask-stream.ts";

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 812 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`Ask renders patched KaTeX with matching styles at ${viewport.width}px`, async ({ app, screen, browser }) => {
    await browser.setViewport(viewport);
    await emulateReducedMotion(browser);
    await installEmitAskMock(browser);
    const dialog = await openAssistant(app, screen, browser, viewport.width);
    await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("请展示公开公式示例");
    await dialog.getByRole("button", "发送问题", { exact: false }).tap();
    await expect(dialog.getByRole("button", "停止生成", { exact: false })).toBeVisible();
    const markdown = "行内公式：$$x_i^2$$。\n\n$$\n\\frac{a_1+b^2}{c_3}\n$$";
    await emitAsk(browser, "text", { delta: `root = TextContent(${JSON.stringify(markdown)})` });
    await emitAsk(browser, "done", {});
    await expect(browser.locator('[role="dialog"] .katex')).toHaveCount(2);
    await expect(browser.locator('[role="dialog"] .katex-display')).toHaveCount(1);
    await expect(browser.locator('[role="dialog"] .katex-error')).toHaveCount(0);
    await expect.poll(() => browser.evaluate(async () => {
      await document.fonts.ready;
      const formulas = [...document.querySelectorAll<HTMLElement>('[role="dialog"] .katex')];
      const display = document.querySelector('[role="dialog"] .katex-display');
      const mathml = document.querySelector('[role="dialog"] .katex-mathml');
      const panel = document.querySelector('[role="dialog"]');
      return formulas.length === 2 && Boolean(display && mathml && panel)
        && formulas.every((formula) => getComputedStyle(formula).fontFamily.includes("KaTeX_Main")
          && formula.getBoundingClientRect().height > 0)
        && getComputedStyle(display!).display === "block"
        && getComputedStyle(mathml!).position === "absolute"
        && [...document.fonts].some((font) => font.family === "KaTeX_Main" && font.status === "loaded")
        && panel!.scrollWidth <= panel!.clientWidth;
    })).toBe(true);
  });

  test(`Ask streams default OpenUI components before citations at ${viewport.width}px`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width: viewport.width, height: viewport.height });
    // reduce 补丁只改 matchMedia 现读，不模拟 CSS 媒体查询：ask-chat.module.css 的 reduce 块
    // 还关闭引用 chevron、citations 等过渡。本组用例保留的已核对依赖是状态现读与引用开合的
    // 最终显隐断言，不声称完整 prefers-reduced-motion 等价。
    await emulateReducedMotion(browser);
    await installEmitAskMock(browser);
    const dialog = await openAssistant(app, screen, browser, viewport.width);
    await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("请整理公开资料");
    await dialog.getByRole("button", "发送问题", { exact: false }).tap();
    await expect(dialog.getByRole("button", "停止生成", { exact: false })).toBeVisible();
    await emitAsk(browser, "text", { delta: `root = Stack([TextContent(${JSON.stringify("## 资料概览\n\n先看**工程实践**。\n\n- 连续阅读\n- 来源可追溯\n\n```ts\nconst ready = true;\n```")}), Tabs([TabItem("overview", "摘要", [TextContent("先看概览")]), TabItem("details", "详细内容", [TextContent("这里是详细说明")])])` });
    await expect(dialog.getByRole("heading", "资料概览", { exact: false })).toBeVisible();
    await expect(browser.locator("[role=\"dialog\"] strong")).toHaveText("工程实践");
    // 框架没有 toHaveCSS：两处样式断言轮询读 computed style。列表断言复现旧版
    // dialog.locator(".ask-openui ul") 的严格单匹配；段落旧版即 .first()，保持首个。
    await expect.poll(() => browser.evaluate(() => {
      const lists = document.querySelectorAll('[role="dialog"] .ask-openui ul');
      if (lists.length !== 1) throw new Error(`expected exactly one openui list, found ${lists.length}`);
      return getComputedStyle(lists[0]).listStyleType;
    })).toBe("disc");
    await expect.poll(() => browser.evaluate(() => {
      const paragraph = document.querySelector('[role="dialog"] .ask-openui p');
      return paragraph ? getComputedStyle(paragraph).fontSize : null;
    })).toBe("13px");
    await emitAsk(browser, "sources", { sources: [{ id: "source-1", title: "测试公开来源", sourceUrl: "/curation/source" }] });
    await expect(dialog.getByRole("list", "回答来源", { exact: false })).toHaveCount(0);
    await emitAsk(browser, "done", {});
    await dialog.getByRole("tab", "详细内容", { exact: false }).tap();
    await expect(dialog.getByText("这里是详细说明", { exact: false })).toBeVisible();
    const sourcesToggle = browser.locator('[role="dialog"] summary').filter({ hasText: "参考资料 · 1 篇" });
    await expect(sourcesToggle).toBeVisible();
    await expect(dialog.getByRole("list", "回答来源", { exact: false })).toBeHidden();
    await sourcesToggle.tap();
    await expect(dialog.getByRole("list", "回答来源", { exact: false })).toBeVisible();
    await sourcesToggle.focus();
    await browser.keyboard.press("Enter");
    await expect(dialog.getByRole("list", "回答来源", { exact: false })).toBeHidden();
    expect(await browser.evaluate(() => {
      const dialogElement = document.querySelector('[role="dialog"]');
      return dialogElement ? dialogElement.scrollWidth <= dialogElement.clientWidth : false;
    })).toBe(true);
    if (viewport.width <= 900) {
      await expect.poll(() => browser.evaluate(() => {
        const input = document.querySelector('[role="dialog"] [aria-label="输入问题"]');
        return input ? getComputedStyle(input).fontSize : null;
      })).toBe("16px");
    }
  });
}
