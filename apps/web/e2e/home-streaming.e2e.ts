import { test } from "@e2e-dev/web";
import { expect } from "e2e";

const profileMarkup = /<aside[^>]*class="curation-home__profile"[^>]*>/gu;
const dotFieldMarkup = /<div[^>]*class="interactive-dot-field"[^>]*>/gu;

test("home streams news through one stable profile shell", async ({ app }) => {
  const response = await fetch(new URL("/", app.baseUrl));
  expect(response.ok).toBe(true);
  const html = await response.text();
  expect(html.match(profileMarkup) ?? []).toHaveLength(1);
  expect(html.match(dotFieldMarkup) ?? []).toHaveLength(1);
  expect(html.replaceAll("<!-- -->", "")).toContain("正在读取每日动态");
});

test("mobile home and section pages keep their distinct layout semantics", async ({ app, browser }) => {
  await browser.setViewport({ height: 844, width: 390 });

  await app.open("/");
  // 开机仪式约 6-7s 才卸载，超过框架默认 5s 断言预算；对齐旧 Playwright 配置的 10s。
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 10_000 });
  await expect(browser).toHaveClass(browser.locator(".curation-home"), /curation-home--mobile-home/u);
  await expect(browser.locator(".curation-home__feed")).toBeHidden();
  await expect(browser.locator(".interactive-dot-field")).toBeVisible();
  await expect(
    browser.locator('nav[aria-label="内容导航"]:visible').getByRole("link", "首页", { exact: false }),
  ).toHaveAttribute("aria-current", "page");

  for (const [path, label] of [
    ["/ai-news", "每日动态"],
    ["/curation", "每日关注"],
    ["/open-source", "开源关注"],
  ] as const) {
    await app.open(path);
    await expect(browser).not.toHaveClass(browser.locator(".curation-home"), /curation-home--mobile-home/u);
    await expect(browser.locator(".curation-home__feed")).toBeVisible();
    await expect(browser.locator(".interactive-dot-field")).toBeHidden();
    await expect(
      browser.locator('nav[aria-label="内容导航"]:visible').getByRole("link", label, { exact: false }),
    ).toHaveAttribute("aria-current", "page");
  }
});
