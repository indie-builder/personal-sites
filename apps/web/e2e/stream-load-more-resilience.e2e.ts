import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import type { Browser } from "@e2e-dev/web";

/**
 * 信息流「加载更多」的失败→重试契约：分页接口被网关 502（HTML 错误页）打断时，
 * 页面只出现中文兜底文案与独立的重试按钮，不把技术性英文
 * （JSON 解析错误、Failed to fetch）暴露给访客；上游恢复后重试可继续追加。
 */
test("curation stream surfaces a Chinese fallback when load more fails and recovers on retry", async ({ app, screen, browser }) => {
  let upstreamHealthy = false;
  await browser.route("**/api/curation?*", async (route) => {
    const offset = Number(new URL(route.request.url).searchParams.get("offset") ?? "0");
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

  await app.open("/curation");
  const feedItems = browser.locator(".curation-home__feed li");
  const status = browser.locator(".curation-home__stream-status");
  await expect(feedItems.first()).toBeVisible();

  // 滚动到底触发下一页请求（被 mock 成网关 502 HTML 错误页）。
  await scrollToFeedEnd(browser);
  const retry = screen.getByRole("button", "重试", { exact: false });
  await expect(retry).toBeVisible();
  const statusText = await status.textContent();
  expect(statusText).toContain("暂时无法加载更多策展内容。");
  expect(statusText).not.toMatch(/Unexpected token|Failed to fetch|SyntaxError/u);

  // 离开底部哨兵，避免失败期间的自动重试与手动重试竞争。
  await browser.evaluate(() => {
    window.scrollTo({ behavior: "instant", top: 0 });
    return null;
  });
  await browser.evaluate((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && ["auto", "scroll"].includes(getComputedStyle(element).overflowY)) element.scrollTop = 0;
    return null;
  }, ".curation-home__feed");

  // 上游恢复后重试：列表追加一页，错误态消失。
  upstreamHealthy = true;
  const itemsBefore = await feedItems.count();
  await retry.click();
  await expect(feedItems).toHaveCount(itemsBefore + 20, { timeout: 15_000 });
  await expect(retry).toHaveCount(0);
});

test("design stream names its own section in the network-failure fallback", async ({ app, screen, browser }) => {
  // 网络层失败（非 JSON 错误响应）：客户端只能用自己的兜底文案，应带板块名。
  await browser.route("**/api/design?*", async (route) => {
    const offset = Number(new URL(route.request.url).searchParams.get("offset") ?? "0");
    if (offset > 0) {
      // 框架的 abort 不带错误码；客户端 fetch 同样以网络层 TypeError 拒绝，注入的故障形态不变。
      await route.abort();
      return;
    }
    await route.continue();
  });

  await app.open("/design");
  await expect(browser.locator(".design-curation__entry").first()).toBeVisible();

  await scrollToFeedEnd(browser);
  await expect(screen.getByRole("button", "重试", { exact: false })).toBeVisible();
  await expect(browser.locator(".curation-home__stream-status")).toContainText("暂时无法加载更多设计收藏。");
});

test("design stream ends with its own section completion copy", async ({ app, browser }) => {
  // 第二页直接返回收尾分页：hasMore=false 且无可追加条目，应显示板块收尾文案。
  await browser.route("**/api/design?*", async (route) => {
    const offset = Number(new URL(route.request.url).searchParams.get("offset") ?? "0");
    if (offset === 0) {
      await route.continue();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ hasMore: false, items: [] }), contentType: "application/json" });
  });

  await app.open("/design");
  await expect(browser.locator(".design-curation__entry").first()).toBeVisible();

  // 框架没有 waitForRequest：改等第二页响应到达，同样证明请求真的发出
  // （首屏数据不足 20 条时收尾文案会直接渲染，用例会空转）。
  const secondPage = browser.waitForResponse(/api\/design\?offset=[1-9]/u);
  await scrollToFeedEnd(browser);
  await secondPage;
  await expect(browser.locator(".curation-home__stream-status")).toContainText("已加载全部设计收藏");
});

async function scrollToFeedEnd(browser: Browser) {
  await browser.evaluate(() => {
    const stream = document.querySelector(".curation-home__stream");
    const feed = stream?.closest(".curation-home__feed");
    if (feed instanceof HTMLElement && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)) {
      feed.scrollTop = feed.scrollHeight;
      return null;
    }
    window.scrollTo({ behavior: "instant", top: document.body.scrollHeight });
    return null;
  });
}
