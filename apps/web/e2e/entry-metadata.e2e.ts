import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import type { Browser } from "@e2e-dev/web";

// 渲染后的元数据契约：详情页 canonical 归一 + 分享卡片覆写（含 og:image——
// 页面级覆写 openGraph 会清掉根段文件约定图），列表与首页 canonical 指向
// 裸路径。硬编码 ID 只需存在于提交的投影中；open-source 详情动态取链。
const CURATION_DETAIL = "/curation/2093695923801210893";
const DESIGN_DETAIL = "/design/2093968955950150059";
const DESIGN_DETAIL_CURATED_PATH = "/curation/2093968955950150059";

async function canonicalPath(browser: Browser) {
  const href = await browser.locator('link[rel="canonical"]').getAttribute("href");
  expect(href, "canonical link present").toBeTruthy();
  return new URL(href as string).pathname;
}

test("curation detail canonical points at itself and share cards carry title and image", async ({ app, browser }) => {
  await app.open(CURATION_DETAIL);
  expect(await canonicalPath(browser)).toBe(CURATION_DETAIL);
  await expect(browser.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜每日关注/u);
  await expect(browser.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(browser.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
  await expect(browser.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
});

test("design detail canonical consolidates onto the curation path", async ({ app, browser }) => {
  await app.open(DESIGN_DETAIL);
  expect(await canonicalPath(browser)).toBe(DESIGN_DETAIL_CURATED_PATH);
  await expect(browser.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜设计收藏/u);
  await expect(browser.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
});

test("open-source detail metadata derive from the visited entry", async ({ app, browser }) => {
  await app.open("/open-source");
  const detailLink = browser.locator('a[href^="/open-source/"]').first();
  await expect(detailLink).toBeVisible();
  const detailPath = await detailLink.getAttribute("href");
  await detailLink.tap();

  await expect(browser).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  expect(await canonicalPath(browser)).toBe(detailPath ?? "");
  await expect(browser.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+｜开源关注/u);
  await expect(browser.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/u);
});

test("home and list pages canonical to bare paths regardless of query params", async ({ app, browser }) => {
  await app.open("/?utm_source=reader");
  expect(await canonicalPath(browser)).toBe("/");

  for (const path of ["/ai-news", "/curation", "/design", "/douyin", "/open-source"]) {
    await app.open(path);
    expect(await canonicalPath(browser), path).toBe(path);
  }
});
