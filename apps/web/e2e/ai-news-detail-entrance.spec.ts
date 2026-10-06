import { expect, test } from "@playwright/test";

// 入场武装回归：--resolved 淡入只在骨架屏真实绘制过（会话标记，detail-entrance 落下）之后发生。
// 这里覆盖三段客户端导航：带新鲜标记的客户端冷导航淡入；标记消费后返回不淡入；无标记的
// 立即可用导航不淡入。硬导航（直连 URL）不在入场范围内：流式 fallback 挂载不了客户端
// 生产者，保持即时换场（见 detail-entrance.tsx 顶部说明）。
// （骨架屏绘制的双 rAF 判定在 tests/ai-news-detail-entrance.test.tsx 单测里覆盖：
// 本机服务端边界窗口只有 ~20ms，浏览器侧无法稳定制造“骨架屏已绘制”的服务端延迟。）
const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";

test("ai-news detail fades in when the painted-skeleton marker armed it and stays instant otherwise", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("personal-site:opening-loader-played", "true");
    const w = window as typeof window & { __detailTransitions: string[] };
    w.__detailTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".ai-news-detail__article")) {
        w.__detailTransitions.push((event as TransitionEvent).propertyName);
      }
    });
  });
  const readTransitions = () => page.evaluate(() => (
    window as typeof window & { __detailTransitions?: string[] }
  ).__detailTransitions ?? []);
  const article = page.locator(".ai-news-detail__article");

  await page.goto("/ai-news");
  const firstLink = page.locator('a[href^="/ai-news/"]').first();
  await expect(firstLink).toBeVisible();
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/ai-news\/[^/]+$/u);
  const detailPath = href as string;

  // 客户端冷导航（骨架屏绘制过 → detail-entrance 已落下新鲜标记）：正文淡入。
  await page.evaluate(({ key, path }) => window.sessionStorage.setItem(
    key,
    JSON.stringify({ at: Date.now(), path }),
  ), { key: FALLBACK_PAINTED_KEY, path: detailPath });
  await firstLink.click();
  await expect(page).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(article).toHaveClass(/ai-news-detail__article--resolved/u);
  await expect.poll(readTransitions).toContain("opacity");
  await expect.poll(() => article.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), FALLBACK_PAINTED_KEY)).toBeNull();

  // 返回导航：标记已被消费，路由缓存直接给出内容，不淡入。
  await page.goBack();
  await expect(page.locator('a[href^="/ai-news/"]').first()).toBeVisible();
  const beforeReturn = await readTransitions();
  await page.locator(`a[href="${detailPath}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(article).not.toHaveClass(/ai-news-detail__article--resolved/u);
  await page.waitForTimeout(400);
  expect(await readTransitions()).toEqual(beforeReturn);

  // 立即可用导航（预取已带全量内容，骨架屏从未绘制，无标记）：直接呈现。
  await page.goBack();
  const secondLink = page.locator('a[href^="/ai-news/"]').nth(1);
  await expect(secondLink).toBeVisible();
  const secondPath = await secondLink.getAttribute("href");
  await secondLink.hover();
  await page.waitForTimeout(600);
  const beforeInstant = await readTransitions();
  await secondLink.click();
  await expect(page).toHaveURL(new RegExp(`${secondPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(article).not.toHaveClass(/ai-news-detail__article--resolved/u);
  await page.waitForTimeout(400);
  expect(await readTransitions()).toEqual(beforeInstant);
});
