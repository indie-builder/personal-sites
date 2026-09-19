import { expect, test } from "@playwright/test";

// 渲染后的元数据契约：详情页 canonical 归一 + 分享卡片覆写（含 og:image——
// 页面级覆写 openGraph 会清掉根段文件约定图），列表与首页 canonical 指向
// 裸路径。硬编码 ID 只需存在于提交的投影中；open-source 详情动态取链。
const CURATION_DETAIL = "/curation/2093695923801210893";
const DESIGN_DETAIL = "/design/2093968955950150059";
const DESIGN_DETAIL_CURATED_PATH = "/curation/2093968955950150059";

async function canonicalPath(page: import("@playwright/test").Page) {
  const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(href, "canonical link present").toBeTruthy();
  return new URL(href as string).pathname;
}

test("curation detail canonical points at itself and share cards carry title and image", async ({ page }) => {
  await page.goto(CURATION_DETAIL);
  expect(await canonicalPath(page)).toBe(CURATION_DETAIL);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜每日关注/u);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
});

test("design detail canonical consolidates onto the curation path", async ({ page }) => {
  await page.goto(DESIGN_DETAIL);
  expect(await canonicalPath(page)).toBe(DESIGN_DETAIL_CURATED_PATH);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜设计收藏/u);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
});

test("open-source detail metadata derive from the visited entry", async ({ page }) => {
  await page.goto("/open-source");
  const detailLink = page.locator('a[href^="/open-source/"]').first();
  await expect(detailLink).toBeVisible();
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.click();

  await expect(page).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  expect(await canonicalPath(page)).toBe(detailPath);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜开源关注/u);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
});

test("home and list pages canonical to bare paths regardless of query params", async ({ page }) => {
  await page.goto("/?view=daily");
  expect(await canonicalPath(page)).toBe("/");

  for (const path of ["/ai-news", "/curation", "/design", "/douyin", "/open-source"]) {
    await page.goto(path);
    expect(await canonicalPath(page), path).toBe(path);
  }
});
