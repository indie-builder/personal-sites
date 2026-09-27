import { expect, test } from "@playwright/test";

const profileMarkup = /<aside[^>]*class="curation-home__profile"[^>]*>/gu;
const dotFieldMarkup = /<div[^>]*class="interactive-dot-field"[^>]*>/gu;

test("home streams news through one stable profile shell", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html.match(profileMarkup) ?? []).toHaveLength(1);
  expect(html.match(dotFieldMarkup) ?? []).toHaveLength(1);
  expect(html).toContain("正在读取每日动态");
});

test("mobile home and section pages keep their distinct layout semantics", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await page.goto("/");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await expect(page.locator(".curation-home")).toHaveClass(/curation-home--mobile-home/u);
  await expect(page.locator(".curation-home__feed")).toBeHidden();
  await expect(page.locator(".interactive-dot-field")).toBeVisible();
  await expect(page.locator('nav[aria-label="内容导航"]:visible').getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");

  for (const [path, label] of [
    ["/ai-news", "每日动态"],
    ["/curation", "每日关注"],
    ["/open-source", "开源关注"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(".curation-home")).not.toHaveClass(/curation-home--mobile-home/u);
    await expect(page.locator(".curation-home__feed")).toBeVisible();
    await expect(page.locator(".interactive-dot-field")).toBeHidden();
    await expect(page.locator('nav[aria-label="内容导航"]:visible').getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});
