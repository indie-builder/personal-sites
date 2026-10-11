import { test } from "@e2e-dev/web";
import { expect } from "e2e";

for (const width of [320, 390, 1440]) {
  test(`作品聊天在 ${width}px 保持输入可见并恢复已完成回答`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height: 844 });
    await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
    await browser.route("**/api/ai-chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/x-ndjson" },
        body: [
          JSON.stringify({ choices: [{ index: 0, delta: { content: 'root = TextContent("迁移验收回答")' }, finish_reason: null }] }),
          JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
        ].join("\n") + "\n",
      });
    });
    await app.open("/products/ai-chat");
    const composer = screen.getByRole("textbox", "发消息给生成式 UI 助手");
    await expect(composer).toBeVisible();
    await expect.poll(() => browser.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>("textarea[aria-label^='发消息给']");
      const rect = input?.getBoundingClientRect();
      return Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
    })).toBe(true);
    await composer.fill("这是公开的迁移测试问题");
    await screen.getByRole("button", "发送消息").tap();
    await expect(screen.getByText("迁移验收回答", { exact: true })).toBeVisible();
    await expect(screen.getByRole("button", "重新生成")).toBeVisible();
    await app.open("/products/ai-chat");
    await expect(screen.getByText("迁移验收回答", { exact: true })).toBeVisible();
    expect(await browser.evaluate(() => document.querySelectorAll("main").length)).toBe(1);
  });
}

test("手机画册逐页阅读，不跳过跨页的第二张图", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 320, height: 812 });
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await app.open("/products/layout-compositions");
  await screen.getByRole("button", "打开构图，86页").tap();
  await expect(screen.getByRole("button", "放大三分法构图")).toBeVisible();
  await expect.poll(() => browser.evaluate(() => document.querySelectorAll("[data-book-spread] [data-page-id]").length)).toBe(1);
  await screen.getByRole("button", "下一页").tap();
  await expect(screen.getByRole("button", "放大黄金比例构图")).toBeVisible();
  const deepLink = await browser.evaluate(() => location.href);
  await app.open(deepLink);
  await expect(screen.getByRole("button", "放大黄金比例构图")).toBeVisible();
  await browser.setViewport({ width: 1440, height: 900 });
  await expect(screen.getByRole("button", "放大三分法构图")).toBeVisible();
  await expect(screen.getByRole("button", "上一页")).toBeDisabled();
  await browser.setViewport({ width: 320, height: 812 });
  await expect(screen.getByRole("button", "放大黄金比例构图")).toBeVisible();
  await screen.getByRole("button", "上一页").tap();
  await expect(screen.getByRole("button", "放大三分法构图")).toBeVisible();
});

test("五个文字游戏均可启动、暂停和重置", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await app.open("/products/word-arcade");
  for (const name of ["打砖块", "贪吃蛇", "文字射击", "飞字打靶", "文字跑酷"]) {
    await screen.getByRole("button", name, { exact: true }).tap();
    await screen.getByRole("button", "开始游戏", { exact: true }).tap();
    await screen.getByRole("button", "暂停游戏").tap();
    await expect(screen.getByText("已暂停", { exact: true })).toBeVisible();
    await screen.getByRole("button", "重新开始").tap();
    await expect(screen.getByRole("button", "开始游戏", { exact: true })).toBeVisible();
  }
});
