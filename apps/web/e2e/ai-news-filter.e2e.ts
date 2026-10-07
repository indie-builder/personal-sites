import type { Browser } from "@e2e-dev/web";
import { expect, test } from "./helpers/loader-key.ts";

test("daily news category menu filters on a narrow screen", async ({ app, browser, screen }) => {
  await browser.setViewport({ width: 320, height: 720 });
  await app.open("/ai-news");
  const trigger = screen.getByRole("button", "筛选每日动态：全部动态", { exact: false });
  await trigger.click();
  const menu = screen.getByRole("menu");
  // 框架 locator 无 evaluate：transformOrigin / 视口右缘读取走页内单匹配，poll 重读与旧断言一致。
  await expect.poll(() => browser.evaluate(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    if (menus.length !== 1) throw new Error(`expected exactly one menu, found ${menus.length}`);
    const menu = menus[0] as HTMLElement;
    const style = getComputedStyle(menu);
    const [x, y] = style.transformOrigin.split(" ").map(parseFloat);
    return Math.abs(x - menu.offsetWidth) < 1 && y === 0;
  })).toBe(true);
  const category = menu.getByRole("menuitemradio").last();
  const label = (await category.textContent())?.trim() ?? "";
  expect(label).not.toBe("全部动态");
  expect(await browser.evaluate(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    if (menus.length !== 1) throw new Error(`expected exactly one menu, found ${menus.length}`);
    return menus[0].getBoundingClientRect().right;
  })).toBeLessThanOrEqual(320);
  await category.click();
  await expect(menu).toBeHidden();
  await expect(screen.getByRole("button", `筛选每日动态：${label}`, { exact: false })).toBeVisible();
  await screen.getByRole("button", `筛选每日动态：${label}`, { exact: false }).click();
  await expect(menu.getByRole("menuitemradio", label, { exact: false })).toHaveAttribute("data-state", "checked");
  await browser.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

function readRenderedCategoryLabels(browser: Browser, knownLabels: string[]) {
  return browser.evaluate((labels) => {
    const known = new Set(labels);
    const rows = Array.from(document.querySelectorAll(".ai-news__entry"));
    return rows.map((row) => {
      const spans = Array.from(row.querySelectorAll(".ai-news__entry-meta span"))
        .map((span) => span.textContent?.trim() ?? "");
      return spans.find((candidate) => known.has(candidate)) ?? null;
    });
  }, knownLabels);
}

const countOf = (labels: Array<string | null>, target: string) => labels.filter((label) => label === target).length;

test("category selection filters the rendered list and reset restores the loaded window", async ({ app, browser, screen }) => {
  await app.open("/ai-news");
  const trigger = screen.getByRole("button", "筛选每日动态：全部动态", { exact: false });
  await trigger.click();
  const menu = screen.getByRole("menu");
  const menuLabels = (await menu.getByRole("menuitemradio").allTextContents()).map((text) => text.trim());
  const categoryLabels = menuLabels.filter((label) => label !== "全部动态" && label !== "精选动态");
  expect(categoryLabels.length, `菜单分类不足两个：${menuLabels.join("、")}`).toBeGreaterThanOrEqual(2);
  const [labelA, labelB] = categoryLabels;
  await browser.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  const before = await readRenderedCategoryLabels(browser, categoryLabels);
  expect(before.length, "首屏窗口为空，无法验证过滤").toBeGreaterThan(0);

  await trigger.click();
  await menu.getByRole("menuitemradio", labelA, { exact: false }).click();
  await expect(menu).toBeHidden();
  await expect(screen.getByRole("button", `筛选每日动态：${labelA}`, { exact: false })).toBeVisible();
  await expect.poll(async () => countOf(await readRenderedCategoryLabels(browser, categoryLabels), labelA))
    .toBe(countOf(before, labelA));
  await expect.poll(async () => countOf(await readRenderedCategoryLabels(browser, categoryLabels), labelB)).toBe(0);
  await expect.poll(async () => (await readRenderedCategoryLabels(browser, categoryLabels)).length)
    .toBe(countOf(before, labelA));

  await screen.getByRole("button", `筛选每日动态：${labelA}`, { exact: false }).click();
  await menu.getByRole("menuitemradio", "全部动态", { exact: false }).click();
  await expect(menu).toBeHidden();
  await expect(screen.getByRole("button", "筛选每日动态：全部动态", { exact: false })).toBeVisible();
  await expect.poll(async () => (await readRenderedCategoryLabels(browser, categoryLabels)).length).toBe(before.length);
  await expect.poll(async () => countOf(await readRenderedCategoryLabels(browser, categoryLabels), labelA))
    .toBe(countOf(before, labelA));
  await expect.poll(async () => countOf(await readRenderedCategoryLabels(browser, categoryLabels), labelB))
    .toBe(countOf(before, labelB));
});

test("all-history exhaustion copy replaces the retired seven-day wording through pagination", async ({ app, browser }) => {
  await browser.route("**/api/ai-news?*", async (route) => {
    const offset = Number(new URL(route.request.url).searchParams.get("offset") ?? "0");
    if (offset === 0) {
      await route.continue();
      return;
    }
    await route.fulfill({ body: JSON.stringify({ hasMore: false, items: [] }), contentType: "application/json" });
  });

  await app.open("/ai-news");
  await expect(browser.locator(".ai-news__entry").first()).toBeVisible();
  const secondPage = browser.waitForResponse(/api\/ai-news\?offset=[1-9]/u);
  await scrollStreamToEnd(browser);
  await secondPage;

  const status = browser.locator(".ai-news__status");
  await expect(status).toContainText("已加载全部动态");
  expect(await status.textContent()).not.toMatch(/7 天/u);
});

async function scrollStreamToEnd(browser: Browser) {
  await browser.evaluate(() => {
    const stream = document.querySelector(".ai-news__stream");
    const feed = stream?.closest(".curation-home__feed");
    if (feed instanceof HTMLElement && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)) {
      feed.scrollTop = feed.scrollHeight;
      return null;
    }
    window.scrollTo({ behavior: "instant", top: document.body.scrollHeight });
    return null;
  });
}
