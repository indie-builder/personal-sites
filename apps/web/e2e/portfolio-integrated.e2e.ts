import { test } from "@e2e-dev/web";
import { expect } from "e2e";

const products = [
  "layout-compositions",
  "muse",
  "design-engineer-tools",
  "personal-sites",
  "ai-coding-dictionary",
  "ai-chat",
  "word-arcade",
] as const;

test("作品集并入本站：七个产品入口可用，公开 API 返回真实数据", async ({ app, screen }) => {
  await app.open("/");
  const portfolioLink = screen.getByRole("link", "作品集", { exact: false });
  await expect(portfolioLink).toHaveAttribute("href", "/portfolio");
  await expect(portfolioLink).not.toHaveAttribute("target", "_blank");

  const overview = await fetch(new URL("/portfolio", app.baseUrl));
  expect(overview.status).toBe(200);
  const index = (await (await fetch(new URL("/api/portfolio", app.baseUrl))).json()) as {
    items: { id: string }[];
  };
  expect(index.items.map((item) => item.id).sort()).toEqual([...products].sort());

  for (const slug of products) {
    const response = await fetch(new URL(`/products/${slug}`, app.baseUrl));
    expect(response.status, `/products/${slug} 应可用`).toBe(200);
  }
  const muse = (await (
    await fetch(new URL("/api/portfolio/muse?limit=2", app.baseUrl))
  ).json()) as { total: number; items: { id: string }[] };
  expect(muse.total).toBeGreaterThan(9000);
  expect(muse.items).toHaveLength(2);
  const layouts = (await (
    await fetch(new URL("/api/portfolio/layouts?limit=1", app.baseUrl))
  ).json()) as { total: number; attribution: string };
  expect(layouts.total).toBe(350);
  expect(layouts.attribution).toContain("CC BY 4.0");
  const hidden = await fetch(new URL("/api/portfolio/muse/does-not-exist", app.baseUrl));
  expect(hidden.status).toBe(404);
});

test("左侧「作品集 / 信息集」切换与产品返回保持浏览器历史", async ({ app, screen, browser }) => {
  await app.open("/");
  await screen.getByRole("link", "作品集", { exact: true }).tap();
  await expect(browser).toHaveURL(/\/portfolio$/u);
  await expect(screen.getByRole("link", "信息集", { exact: true })).toHaveAttribute("href", "/");
  await expect(screen.getByRole("link", "打开布局参考")).toBeVisible();

  await screen.getByRole("link", "打开布局参考").tap();
  await expect(browser).toHaveURL(/\/products\/layout-compositions$/u);
  const overviewReturn = screen.getByRole("link", "返回作品集");
  await expect(overviewReturn).toBeVisible();
  await expect(overviewReturn).toHaveAttribute("href", "/portfolio#portfolio-work-layout-compositions");
  await expect(screen.getByRole("link", "信息集", { exact: true })).toHaveAttribute("href", "/");

  await browser.back();
  await expect(browser).toHaveURL(/\/portfolio$/u);
  await screen.getByRole("link", "信息集", { exact: true }).tap();
  await expect(browser).toHaveURL(/\/$/u);
  await expect(screen.getByRole("link", "作品集", { exact: true })).toHaveAttribute("href", "/portfolio");
});

test("作品图鉴可以搜索、阅读、放大并返回", async ({ app, screen }) => {
  await app.open("/products/layout-compositions");
  await screen.getByRole("searchbox", "搜索图鉴名称或主题").fill("三分法");
  await screen.getByRole("button", "三分法构图", { exact: false }).tap();
  await expect(screen.getByRole("region", "构图画册")).toBeVisible();
  await screen.getByRole("button", "放大三分法构图").tap();
  await expect(screen.getByRole("dialog", "三分法构图")).toBeVisible();
  await screen.getByRole("button", "关闭", { exact: true }).tap();
  await expect(screen.getByRole("dialog", "三分法构图")).toBeHidden();
  await screen.getByRole("button", "返回书架").tap();
  await expect(screen.getByRole("searchbox", "搜索图鉴名称或主题")).toBeVisible();
});

test("七个作品根页与灵感集详情都只有一个「返回作品集」出口", async ({ app }) => {
  const muse = (await (await fetch(new URL("/api/portfolio/muse?limit=1", app.baseUrl))).json()) as {
    items: { href: string }[];
  };
  const pages = [...products.map((slug) => `/products/${slug}`), muse.items[0]?.href ?? "/products/muse"];
  for (const page of pages) {
    const html = await (await fetch(new URL(page, app.baseUrl))).text();
    expect(html.match(/<a\b[^>]*\sdata-portfolio-return(?:=|\s|>)/gu)?.length ?? 0, page).toBe(1);
    expect(html.includes("返回作品集"), page).toBe(true);
  }
});

test("词典允许本地嵌入，普通页面仍禁止 framing", async ({ app }) => {
  const runtime = await fetch(new URL("/ai-coding-atlas/index.html", app.baseUrl));
  expect(runtime.status).toBe(200);
  expect(runtime.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  const overview = await fetch(new URL("/portfolio", app.baseUrl));
  expect(overview.headers.get("x-frame-options")).toBe("DENY");
});
