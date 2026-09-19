import { expect, test } from "@playwright/test";

// 这些 ID 只需存在于提交的投影中（详情可渲染、排除关系成立），不要求留在列表首页。
const CURATION_DETAIL = "/curation/2093695923801210893";
const DESIGN_DETAIL = "/design/2093968955950150059";
const DOUYIN_DETAIL = "/curation/douyin-7685693822096985385";

test("curation, design and douyin detail paths keep ISR without request-time query state", async ({ request }) => {
  for (const path of [CURATION_DETAIL, DESIGN_DETAIL, DOUYIN_DETAIL]) {
    const first = await request.get(path);
    expect(first.ok(), path).toBe(true);
    expect(["HIT", "MISS"]).toContain(first.headers()["x-nextjs-cache"]);

    const second = await request.get(path);
    expect(second.ok(), path).toBe(true);
    expect(second.headers()["x-nextjs-cache"]).toBe("HIT");
  }

  const excluded = await request.get("/design/2093695923801210893");
  expect(excluded.status()).toBe(404);
});

test("design list and detail navigation stay in the design path", async ({ page }) => {
  await page.goto("/design");
  // 从实际渲染的列表取目标，避免投影数据更新后硬编码 ID 掉出首页。
  const detailLink = page.locator('a[href^="/design/"]').first();
  await expect(detailLink).toBeVisible();
  await expect(detailLink).toHaveAttribute("href", /.+/u);
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.click();

  await expect(page).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(page.getByRole("link", { name: "返回设计收藏" })).toBeVisible();
  await expect(page.locator('nav[aria-label="相邻剪报"] a').first()).toHaveAttribute("href", /\/design\//u);
});

test("douyin list navigation lands on the shared detail path with a section back link", async ({ page }) => {
  await page.goto("/douyin");
  // 抖音条目复用 /curation/[id] 详情路由，从实际列表动态取目标。
  const detailLink = page.locator('a[href^="/curation/douyin-"]').first();
  await expect(detailLink).toBeVisible();
  await expect(detailLink).toHaveAttribute("href", /.+/u);
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.click();

  await expect(page).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  const back = page.getByRole("link", { name: "返回抖音收藏" });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("href", "/douyin");
});
