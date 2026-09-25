import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("作品集与个人站同域运行", async ({ page, request }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "作品时间轴" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回个人站" })).toBeVisible();

  const products = ["layout-compositions", "muse", "design-engineer-tools", "personal-sites"];
  for (const slug of products) {
    const href = `/portfolio/products/${slug}`;
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(page.locator("#workspace-content")).toBeVisible();
    if (slug === "muse") {
      const preview = page.locator('video[poster^="/inspora/posters/"]').first();
      await expect(preview).toBeVisible();
      expect(await preview.getAttribute("src")).toMatch(/^https:\/\//u);
      expect((await request.get((await preview.getAttribute("poster"))!)).status()).toBe(200);
    }
    await page.goto("/portfolio");
  }

  const api = await request.get("/api/portfolio");
  expect(api.status()).toBe(200);
  const body = await api.json();
  expect(body.items.map((item: { id: string }) => item.id)).toEqual(products);
  expect(JSON.stringify(body)).not.toMatch(/raw_json|syncedAt|sizeBytes/);
  const muse = await request.get("/api/portfolio/muse?limit=1");
  expect(muse.status()).toBe(200);
  const museItems = (await muse.json()).items;
  expect(museItems).toHaveLength(1);
  expect((await request.get(`/api/portfolio/muse/${museItems[0].id}`)).status()).toBe(200);
  const layouts = await request.get("/api/portfolio/layouts?limit=1");
  expect(layouts.status()).toBe(200);
  expect((await layouts.json()).total).toBe(350);
  expect((await request.get("/api/portfolio/tools")).status()).toBe(200);
  expect((await request.get("/api/portfolio/site")).status()).toBe(200);
  expect((await request.get("/api/portfolio/layouts?limit=0")).status()).toBe(400);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portfolio");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "返回个人站" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "作品集" }).click();
  await expect(page).toHaveURL("/portfolio");

  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/portfolio-integration.json",
    JSON.stringify({ routes: ["/portfolio", ...products.map((slug) => `/portfolio/products/${slug}`)], api: ["/api/portfolio", "/api/portfolio/layouts", "/api/portfolio/muse", "/api/portfolio/tools", "/api/portfolio/site"], mobileWidth: 390, passed: true }, null, 2) + "\n",
  );
});
