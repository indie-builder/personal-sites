import { expect, test } from "@playwright/test";

/**
 * 信息流「加载更多」的失败→重试契约：分页接口被网关 502（HTML 错误页）打断时，
 * 页面只出现中文兜底文案与独立的重试按钮，不把技术性英文
 * （JSON 解析错误、Failed to fetch）暴露给访客；上游恢复后重试可继续追加。
 */
test("curation stream surfaces a Chinese fallback when load more fails and recovers on retry", async ({ page }) => {
  let upstreamHealthy = false;
  await page.route("**/api/curation?*", async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0");
    if (offset > 0 && !upstreamHealthy) {
      await route.fulfill({
        body: "<html>502 Bad Gateway</html>",
        contentType: "text/html; charset=utf-8",
        status: 502,
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/curation");
  const feed = page.locator(".curation-home__feed");
  const status = page.locator(".curation-home__stream-status");
  await expect(feed.locator("li").first()).toBeVisible();

  // 滚动到底触发下一页请求（被 mock 成网关 502 HTML 错误页）。
  await scrollToFeedEnd(page);
  const retry = page.getByRole("button", { name: "重试" });
  await expect(retry).toBeVisible();
  const statusText = await status.innerText();
  expect(statusText).toContain("暂时无法加载更多策展内容。");
  expect(statusText).not.toMatch(/Unexpected token|Failed to fetch|SyntaxError/u);

  // 离开底部哨兵，避免失败期间的自动重试与手动重试竞争。
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await feed.evaluate((element) => {
    if (["auto", "scroll"].includes(getComputedStyle(element).overflowY)) element.scrollTop = 0;
  });

  // 上游恢复后重试：列表追加一页，错误态消失。
  upstreamHealthy = true;
  const itemsBefore = await feed.locator("li").count();
  await retry.click();
  await expect(feed.locator("li")).toHaveCount(itemsBefore + 20, { timeout: 15_000 });
  await expect(retry).toHaveCount(0);
});

test("design stream names its own section in the network-failure fallback", async ({ page }) => {
  // 网络层失败（非 JSON 错误响应）：客户端只能用自己的兜底文案，应带板块名。
  await page.route("**/api/design?*", async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0");
    if (offset > 0) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/design");
  await expect(page.locator(".design-curation__entry").first()).toBeVisible();

  await scrollToFeedEnd(page);
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
  await expect(page.locator(".curation-home__stream-status")).toContainText("暂时无法加载更多设计收藏。");
});

test("design stream ends with its own section completion copy", async ({ page }) => {
  // 第二页直接返回收尾分页：hasMore=false 且无可追加条目，应显示板块收尾文案。
  await page.route("**/api/design?*", async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0");
    if (offset === 0) {
      await route.continue();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ hasMore: false, items: [] }), contentType: "application/json" });
  });

  await page.goto("/design");
  await expect(page.locator(".design-curation__entry").first()).toBeVisible();

  // 先确认第二页请求真的发出（首屏数据不足 20 条时收尾文案会直接渲染，用例会空转）。
  const secondPage = page.waitForRequest(/api\/design\?offset=[1-9]/u);
  await scrollToFeedEnd(page);
  await secondPage;
  await expect(page.locator(".curation-home__stream-status")).toContainText("已加载全部设计收藏");
});

async function scrollToFeedEnd(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const stream = document.querySelector(".curation-home__stream");
    const feed = stream?.closest(".curation-home__feed");
    if (feed instanceof HTMLElement && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)) {
      feed.scrollTop = feed.scrollHeight;
      return;
    }
    window.scrollTo({ behavior: "instant", top: document.body.scrollHeight });
  });
}
