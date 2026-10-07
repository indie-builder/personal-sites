import { expect, test } from "./helpers/loader-key.ts";

// 入场武装回归：--resolved 淡入只在骨架屏真实绘制过（会话标记，detail-entrance 落下）之后发生。
// 这里覆盖三段客户端导航：带新鲜标记的客户端冷导航淡入；标记消费后返回不淡入；无标记的
// 立即可用导航不淡入。硬导航（直连 URL）不在入场范围内：流式 fallback 挂载不了客户端
// 生产者，保持即时换场（见 detail-entrance.tsx 顶部说明）。
// （骨架屏绘制的双 rAF 判定在 tests/ai-news-detail-entrance.test.tsx 单测里覆盖：
// 本机服务端边界窗口只有 ~20ms，浏览器侧无法稳定制造“骨架屏已绘制”的服务端延迟。）
const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";

// 框架没有 waitForTimeout：与旧 API 同为 Node 侧纯延时，用于给“负向断言”
// （一段时间内不得发生过渡）留出观察窗。
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("ai-news detail fades in when the painted-skeleton marker armed it and stays instant otherwise", async ({ app, browser }) => {
  await browser.addInitScript(() => {
    const w = window as typeof window & { __detailTransitions: string[] };
    w.__detailTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".ai-news-detail__article")) {
        w.__detailTransitions.push((event as TransitionEvent).propertyName);
      }
    });
  });
  const readTransitions = () => browser.evaluate(() => (
    window as typeof window & { __detailTransitions?: string[] }
  ).__detailTransitions ?? []);
  const article = browser.locator(".ai-news-detail__article");

  await app.open("/ai-news");
  const firstLink = browser.locator('a[href^="/ai-news/"]').first();
  await expect(firstLink).toBeVisible();
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/ai-news\/[^/]+$/u);
  const detailPath = href as string;

  // 客户端冷导航（骨架屏绘制过 → detail-entrance 已落下新鲜标记）：正文淡入。
  // 标记须带目的历史条目的 entryId（消费侧按条目身份比对）。本机无法稳定制造
  // “骨架屏绘制过”的服务端窗口，改为包一层 pushState：在目的条目铸造的同一刻
  // 读取 navigation.currentEntry.id 落下完整标记，必然早于正文挂载后的消费
  // effect。一次性还原，返回与再次进入的导航不再播种。
  await browser.evaluate(({ key, path }) => {
    const next = window.history.pushState.bind(window.history);
    window.history.pushState = (...args: Parameters<typeof next>) => {
      window.history.pushState = next;
      next(...args);
      try {
        window.sessionStorage.setItem(
          key,
          JSON.stringify({ at: Date.now(), path, entryId: window.navigation?.currentEntry?.id ?? null }),
        );
      } catch {
        // 与生产者同款容错：存储受限则按未绘制处理。
      }
    };
    return null;
  }, { key: FALLBACK_PAINTED_KEY, path: detailPath });
  await firstLink.click();
  await expect(browser).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(browser).toHaveClass(article, /ai-news-detail__article--resolved/u);
  await expect.poll(readTransitions).toContain("opacity");
  // 框架 locator 无 evaluate：computed opacity 经页内单匹配读取 + poll 重读，与旧断言等价。
  await expect.poll(() => browser.evaluate(() => {
    const matches = document.querySelectorAll(".ai-news-detail__article");
    if (matches.length !== 1) throw new Error(`expected exactly one article, found ${matches.length}`);
    return getComputedStyle(matches[0]).opacity;
  })).toBe("1");
  expect(await browser.evaluate((key) => window.sessionStorage.getItem(key), FALLBACK_PAINTED_KEY)).toBeNull();

  // 返回导航：标记已被消费，路由缓存直接给出内容，不淡入。
  await browser.back();
  await expect(browser.locator('a[href^="/ai-news/"]').first()).toBeVisible();
  const beforeReturn = await readTransitions();
  await browser.locator(`a[href="${detailPath}"]`).first().click();
  await expect(browser).toHaveURL(new RegExp(`${detailPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(browser).not.toHaveClass(article, /ai-news-detail__article--resolved/u);
  await settle(400);
  expect(await readTransitions()).toEqual(beforeReturn);

  // 立即可用导航（预取已带全量内容，骨架屏从未绘制，无标记）：直接呈现。
  await browser.back();
  const secondLink = browser.locator('a[href^="/ai-news/"]').nth(1);
  await expect(secondLink).toBeVisible();
  const secondPath = await secondLink.getAttribute("href");
  await secondLink.hover();
  await settle(600);
  const beforeInstant = await readTransitions();
  await secondLink.click();
  await expect(browser).toHaveURL(new RegExp(`${secondPath}$`, "u"));
  await expect(article).toHaveAttribute("data-content-id", /.+/u);
  await expect(browser).not.toHaveClass(article, /ai-news-detail__article--resolved/u);
  await settle(400);
  expect(await readTransitions()).toEqual(beforeInstant);
});
