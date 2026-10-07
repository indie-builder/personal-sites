import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// 这些 ID 只需存在于提交的投影中（详情可渲染、排除关系成立），不要求留在列表首页。
const CURATION_DETAIL = "/curation/2093695923801210893";
const DESIGN_DETAIL = "/design/2093968955950150059";
const DOUYIN_DETAIL = "/curation/douyin-7685693822096985385";

test("curation, design and douyin detail paths keep ISR without request-time query state", async ({ app }) => {
  // 旧 request fixture 直打接口：同样不经页面。request.get 等响应体结束才返回，
  // fetch 响应头即返回；每处先 arrayBuffer() 消费完响应体再断言与发起下一次请求，
  // 补回旧的响应完成边界，避免第二次请求追进第一次响应未完的窗口。
  for (const path of [CURATION_DETAIL, DESIGN_DETAIL, DOUYIN_DETAIL]) {
    const first = await fetch(new URL(path, app.baseUrl));
    await first.arrayBuffer();
    expect(first.ok, path).toBe(true);
    expect(["HIT", "MISS"], path).toContain(first.headers.get("x-nextjs-cache"));

    const second = await fetch(new URL(path, app.baseUrl));
    await second.arrayBuffer();
    expect(second.ok, path).toBe(true);
    expect(second.headers.get("x-nextjs-cache"), path).toBe("HIT");
  }

  const excluded = await fetch(new URL("/design/2093695923801210893", app.baseUrl));
  await excluded.arrayBuffer();
  expect(excluded.status).toBe(404);
});

test("design list and detail navigation stay in the design path", async ({ app, browser, screen }) => {
  await app.open("/design");
  // 从实际渲染的列表取目标，避免投影数据更新后硬编码 ID 掉出首页。
  const detailLink = browser.locator('a[href^="/design/"]').first();
  await expect(detailLink).toBeVisible();
  await expect(detailLink).toHaveAttribute("href", /.+/u);
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.click();

  await expect(browser).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(screen.getByRole("link", "返回设计收藏", { exact: false })).toBeVisible();
  await expect(browser.locator('nav[aria-label="相邻剪报"] a').first()).toHaveAttribute("href", /\/design\//u);

  // 同板块邻接切换真实可达：点击相邻链接落在另一条 /design 详情，标题随目标切换，
  // 再经返回链接回到 /design 列表（相邻剪报是必备结构，缺位即失败，不条件跳过）。
  const neighbor = browser.locator('nav[aria-label="相邻剪报"] a').first();
  const neighborHref = await neighbor.getAttribute("href");
  // 框架 Locator 无 .locator 子查询：strong 标题用同源选择器直取首条链接内唯一 strong。
  const neighborTitle = await browser.locator('nav[aria-label="相邻剪报"] a strong').first().textContent();
  expect(neighborHref, "相邻链接必须有 href").toMatch(/^\/design\//u);
  expect(neighborTitle?.trim() ?? "", "相邻链接必须带标题").not.toBe("");
  await neighbor.click();
  await expect(browser).toHaveURL(new RegExp(`${neighborHref}$`, "u"));
  await expect(browser.locator("article h1")).toHaveText(neighborTitle?.trim() ?? "");
  const back = screen.getByRole("link", "返回设计收藏", { exact: false });
  await expect(back).toBeVisible();
  await back.click();
  await expect(browser).toHaveURL(/\/design$/u);
  await expect(browser.locator('a[href^="/design/"]').first()).toBeVisible();
});

test("douyin list navigation lands on the shared detail path with a section back link", async ({ app, browser, screen }) => {
  await app.open("/douyin");
  const detailLink = browser.locator('a[href^="/curation/douyin-"]').first();
  await expect(detailLink).toBeVisible();
  await expect(detailLink).toHaveAttribute("href", /.+/u);
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.click();

  await expect(browser).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  const back = screen.getByRole("link", "返回抖音收藏", { exact: false });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/douyin");

  const neighbor = browser.locator('nav[aria-label="相邻剪报"] a').first();
  const neighborHref = await neighbor.getAttribute("href");
  const neighborTitle = await browser.locator('nav[aria-label="相邻剪报"] a strong').first().textContent();
  expect(neighborHref, "相邻链接必须有 href").toMatch(/^\/curation\/douyin-/u);
  expect(neighborHref, "相邻目标必须不同于当前详情").not.toBe(detailPath);
  expect(neighborTitle?.trim() ?? "", "相邻链接必须带标题").not.toBe("");
  await neighbor.click();
  await expect(browser).toHaveURL(new RegExp(`${neighborHref}$`, "u"));
  await expect(browser.locator("article h1")).toHaveText(neighborTitle?.trim() ?? "");
  const backToList = screen.getByRole("link", "返回抖音收藏", { exact: false });
  await expect(backToList).toBeVisible();
  await backToList.click();
  await expect(browser).toHaveURL(/\/douyin$/u);
  await expect(browser.locator('a[href^="/curation/douyin-"]').first()).toBeVisible();
});
