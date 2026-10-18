import type { AskSource } from "../lib/ask-types.ts";
import { expect, test } from "./helpers/loader-key.ts";
import { openAssistant } from "./helpers/assistant.ts";
import { emitAsk, installEmitAskMock } from "./helpers/ask-stream.ts";

const streamedSource = {
  content: "恢复测试来源正文",
  id: "source-1",
  publishedAt: null,
  scope: "daily",
  section: null,
  sourceId: "curation-source",
  sourceUrl: "/curation/source",
  title: "恢复测试来源",
} satisfies AskSource;

test("Ask stop keeps the partial answer and restores a usable composer", async ({ app, screen, browser }) => {
  await installEmitAskMock(browser);
  const dialog = await openAssistant(app, screen, browser);
  await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("请整理公开资料");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  await emitAsk(browser, "text", { delta: 'root = TextContent("部分结论先行' });
  await expect(dialog.getByText("部分结论先行", { exact: false })).toBeVisible();

  await dialog.getByRole("button", "停止生成", { exact: false }).tap();
  await expect(dialog.getByRole("button", "发送问题", { exact: false })).toBeVisible();
  await expect(dialog.getByText("已停止生成。", { exact: false })).toBeVisible();
  await expect(dialog.getByText("部分结论先行", { exact: false })).toBeVisible();

  // 流已取消，enqueue 可能抛错；迟到片段即使送达也不得进入答案。
  await browser.evaluate(() => {
    const controls = window as typeof window & { emitAsk?: (event: string, data: unknown) => void };
    try {
      controls.emitAsk?.("text", { delta: '！迟到追加不许出现")' });
    } catch {}
    return null;
  });
  await expect(dialog.getByText("部分结论先行", { exact: false })).toBeVisible();
  await expect(dialog.getByText("迟到追加不许出现", { exact: false })).not.toBeVisible();

  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.fill("换个关键词再问");
  await expect(dialog.getByRole("button", "发送问题", { exact: false })).toBeEnabled();
});

test("Ask late delta appends into the answer while the stream is running", async ({ app, screen, browser }) => {
  await installEmitAskMock(browser);
  const dialog = await openAssistant(app, screen, browser);
  await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("公开资料里的检索实践");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  await emitAsk(browser, "text", { delta: 'root = TextContent("首段结论先行' });
  await emitAsk(browser, "text", { delta: '！迟到片段照常上屏")' });
  await emitAsk(browser, "done", {});
  await expect(dialog.getByText("首段结论先行！迟到片段照常上屏", { exact: false })).toBeVisible();
});

test("Ask conversation and unsent draft survive a full reload", async ({ app, screen, browser }) => {
  await installEmitAskMock(browser);
  const dialog = await openAssistant(app, screen, browser);
  await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("会话恢复测试问题");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  await emitAsk(browser, "text", { delta: 'root = TextContent("恢复后的回答内容")' });
  await emitAsk(browser, "sources", { sources: [streamedSource] });
  await emitAsk(browser, "done", {});
  await expect(browser.locator('[role="dialog"] summary').filter({ hasText: "参考资料 · 1 篇" })).toBeVisible();
  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.fill("还没发送的草稿");

  await browser.reload();
  const restored = await openAssistant(app, screen, browser);
  await expect(restored.getByText("会话恢复测试问题", { exact: false })).toBeVisible();
  await expect(restored.getByText("恢复后的回答内容", { exact: false })).toBeVisible();
  await expect(browser.locator('[role="dialog"] summary').filter({ hasText: "参考资料 · 1 篇" })).toBeVisible();
  await expect(restored.getByRole("textbox", "输入问题", { exact: false })).toHaveValue("还没发送的草稿");
});

test("Ask stream error offers retry that resends the original question and keeps the draft", async ({ app, screen, browser }) => {
  const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let attempt = 0;
  const requestedQuestions: string[] = [];
  await browser.route("**/api/ask", async (route) => {
    attempt += 1;
    requestedQuestions.push(String(
      (JSON.parse(route.request.postData ?? "{}") as { question?: unknown }).question ?? "",
    ));
    if (attempt === 1) {
      await route.fulfill({
        body: sse("text", { delta: 'root = TextContent("公开资料里没有直接答案")' })
          + sse("error", { message: "回答暂时不可用，请稍后重试。" })
          + sse("done", {}),
        contentType: "text/event-stream",
        status: 200,
      });
      return;
    }
    await route.fulfill({
      body: sse("text", { delta: 'root = TextContent("重新整理后的完整回答")' })
        + sse("sources", { sources: [streamedSource] })
        + sse("done", {}),
      contentType: "text/event-stream",
      status: 200,
    });
  });

  const dialog = await openAssistant(app, screen, browser);
  await dialog.getByRole("textbox", "输入问题", { exact: false }).fill("整理检索实践");
  await dialog.getByRole("button", "发送问题", { exact: false }).tap();
  const retry = dialog.getByRole("button", "重新提问", { exact: false });
  await expect(retry).toBeVisible();
  await expect(dialog.getByText("回答暂时不可用，请稍后重试。", { exact: false })).toBeVisible();

  const input = dialog.getByRole("textbox", "输入问题", { exact: false });
  await input.fill("帮我补充工程背景。");
  await retry.tap();
  expect(requestedQuestions).toEqual(["整理检索实践", "整理检索实践"]);
  await expect(dialog.getByText("整理检索实践", { exact: false })).toHaveCount(2);
  await expect(browser.locator('[role="dialog"] [data-slot="message"]').filter({ hasText: "帮我补充工程背景。" })).toHaveCount(0);
  await expect(input).toHaveValue("帮我补充工程背景。");
  await expect(dialog.getByText("重新整理后的完整回答", { exact: false })).toBeVisible();
  await expect(browser.locator('[role="dialog"] summary').filter({ hasText: "参考资料 · 1 篇" })).toBeVisible();
});
