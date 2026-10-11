import { expect, test, type Browser } from "./helpers/loader-key.ts";


const WORKS = [
  ["layout-compositions", "布局参考"],
  ["muse", "灵感集"],
  ["design-engineer-tools", "设计工程工具"],
  ["personal-sites", "个人网站"],
  ["ai-coding-dictionary", "AI Coding 词典"],
  ["ai-chat", "AI 问答"],
  ["word-arcade", "文字游乐场"],
] as const;

const activePreview = (browser: Browser) =>
  browser.evaluate(() => document.querySelector("[data-portfolio-gallery]")?.getAttribute("data-active-preview") ?? "");

// 把某模块顶边对到视口 25% 处：阅读线（约 35vh）落在该模块内容内，
// 使它成为「最近可见模块」，不依赖滚动容器的实现细节。
const scrollToWork = (browser: Browser, slug: string) =>
  browser.evaluate((target) => {
    const link = document.getElementById(`portfolio-work-${target}`);
    if (!link) return false;
    window.scrollTo({ top: link.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25 });
    return true;
  }, slug);

const workInViewport = (browser: Browser, slug: string) =>
  browser.evaluate((target) => {
    const link = document.getElementById(`portfolio-work-${target}`);
    if (!link) return false;
    const rect = link.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight + 1;
  }, slug);

test("结构契约：七个独立模块单列排开、日期逐卡重复在链接内，无尾站与时间轴残留", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  for (const [slug, name] of WORKS) {
    await expect(screen.getByRole("link", `打开${name}`)).toHaveAttribute("id", `portfolio-work-${slug}`);
  }
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const gallery = document.querySelector("[data-portfolio-gallery]");
        const list = document.querySelector("ol[data-portfolio-list]");
        const items = [...document.querySelectorAll("li[data-portfolio-item]")];
        const links = [...document.querySelectorAll("a[data-portfolio-work]")];
        const dates = items.map((item) => item.querySelector(":scope > a time")?.textContent?.trim() ?? "");
        const datePattern = /^\d{4}\.\d{2}\.\d{2}$/u;
        // 同日作品各带自己的日期：升序是非严格的，日期数等于模块数而不是分组数。
        const ascending = dates.every((date, index) => index === 0 || dates[index - 1]! <= date);
        return {
          itemCount: items.length,
          itemSlugs: items.map((item) => item.getAttribute("data-portfolio-item")),
          linkCount: links.length,
          linkIds: links.map((link) => link.id),
          datePerItem: dates.length === 7 && dates.every((date) => datePattern.test(date)) && ascending,
          endMarkers: document.body.textContent?.includes("未完待续") ? 1 : 0,
          timelineLeftovers: document.querySelectorAll(
            "[data-portfolio-timeline], [data-timeline-list], [data-timeline-stop], [data-timeline-end], [data-continue], [data-timeline-caption]",
          ).length,
          horizontalButtons: [...document.querySelectorAll("button")].filter((button) => {
            const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
            return name.includes("向前浏览作品") || name.includes("向后浏览作品");
          }).length,
          listInGallery: Boolean(gallery?.contains(list)),
        };
      }),
    )
    .toEqual({
      itemCount: 7,
      itemSlugs: WORKS.map(([slug]) => slug),
      linkCount: 7,
      linkIds: WORKS.map(([slug]) => `portfolio-work-${slug}`),
      datePerItem: true,
      endMarkers: 0,
      timelineLeftovers: 0,
      horizontalButtons: 0,
      listInGallery: true,
    });
  // 方向键不被拦截：ArrowDown 仍原生滚动页面。
  await browser.keyboard.press("ArrowDown");
  await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("滚动只移动唯一的预览资格标记，不产生当前卡片视觉，焦点不被挪动", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await expect(screen.getByRole("link", "打开布局参考")).toBeVisible();
  await expect.poll(() => activePreview(browser)).toBe("layout-compositions");
  await scrollToWork(browser, "personal-sites");
  await expect.poll(() => activePreview(browser)).toBe("personal-sites");
  await scrollToWork(browser, "ai-chat");
  await expect.poll(() => activePreview(browser)).toBe("ai-chat");
  expect(await browser.evaluate(() => document.querySelectorAll('li[data-portfolio-item][data-active], li[data-portfolio-item][aria-current]').length)).toBe(0);
  expect(await browser.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test("直接点击模块文本与缩略图都能进入详情", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await scrollToWork(browser, "muse");
  await screen.getByRole("link", "打开灵感集").tap();
  await expect(browser).toHaveURL(/\/products\/muse$/u);
  await browser.back();
  await expect(browser).toHaveURL(/\/portfolio$/u);
  await scrollToWork(browser, "word-arcade");
  await browser.locator('[data-preview-station="word-arcade"]').click();
  await expect(browser).toHaveURL(/\/products\/word-arcade$/u);
});

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`${width}×${height}：显式「返回作品集」原生锚点把出发模块带回视口`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height });
    await app.open("/portfolio");
    await scrollToWork(browser, "word-arcade");
    await screen.getByRole("link", "打开文字游乐场").tap();
    await expect(browser).toHaveURL(/\/products\/word-arcade$/u);
    const backLink = screen.getByRole("link", "返回作品集");
    await expect(backLink).toHaveAttribute("href", "/portfolio#portfolio-work-word-arcade");
    await backLink.tap();
    await expect(browser).toHaveURL(/\/portfolio#portfolio-work-word-arcade$/u);
    await expect.poll(() => workInViewport(browser, "word-arcade")).toBe(true);
    await expect.poll(() => activePreview(browser)).toBe("word-arcade");
  });
}

test("浏览器后退用原生滚动恢复离开时的阅读位置", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await scrollToWork(browser, "ai-chat");
  await expect.poll(() => activePreview(browser)).toBe("ai-chat");
  const departed = await browser.evaluate(() => window.scrollY);
  expect(departed).toBeGreaterThan(0);
  await screen.getByRole("link", "打开AI 问答").tap();
  await expect(browser).toHaveURL(/\/products\/ai-chat$/u);
  await browser.back();
  await expect(browser).toHaveURL(/\/portfolio$/u);
  await expect.poll(() => workInViewport(browser, "ai-chat")).toBe(true);
  await expect
    .poll(() => browser.evaluate((left) => Math.abs(window.scrollY - left) <= window.innerHeight, departed))
    .toBe(true);
});

const VIEWPORTS = [
  { width: 320, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

for (const { width, height } of VIEWPORTS) {
  test(`${width}×${height}：模块单列向下排开，页面不横向溢出，缩略图留在各自卡片内`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height });
    await app.open("/portfolio");
    await expect(screen.getByRole("link", "打开布局参考")).toBeVisible();
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const gallery = document.querySelector("[data-portfolio-gallery]");
          const items = [...document.querySelectorAll("li[data-portfolio-item]")];
          if (!gallery || items.length !== 7) return null;
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const innerSlack = gallery.scrollHeight - gallery.clientHeight;
          const rects = items.map((item) => item.getBoundingClientRect());
          let stackedDown = true;
          for (let index = 1; index < rects.length; index += 1) {
            if (rects[index]!.top <= rects[index - 1]!.top) stackedDown = false;
          }
          // 各模块预览比例有意不同（不强制等宽等高），只断言非零且完整落在自己的卡片里。
          const previewsInside = [...gallery.querySelectorAll("[data-preview-station]")].every((frame) => {
            const card = frame.closest("li[data-portfolio-item]");
            if (!card) return false;
            const rect = frame.getBoundingClientRect();
            const bounds = card.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.left >= bounds.left - 1 &&
              rect.right <= bounds.right + 1 &&
              rect.top >= bounds.top - 1 &&
              rect.bottom <= bounds.bottom + 1
            );
          });
          return { noHorizontalOverflow: overflow <= 0, noInnerVerticalScroll: innerSlack <= 0, stackedDown, previewsInside };
        }),
      )
      .toEqual({ noHorizontalOverflow: true, noInnerVerticalScroll: true, stackedDown: true, previewsInside: true });
    if (width >= 1024) {
      const rail = await browser.locator(".curation-home__profile").boundingBox();
      const galleryBox = await browser.locator("[data-portfolio-gallery]").boundingBox();
      expect(rail?.width ?? 0).toBeGreaterThan(200);
      expect(rail && galleryBox ? rail.x + rail.width <= galleryBox.x : false).toBe(true);
    }
  });
}
