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

const activeStation = (browser: Browser) =>
  browser.evaluate(() => document.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station") ?? "");

// 把某站作品顶边对到视口 25% 处：阅读线（约 28-35vh）落在该站内容内，
// 使它成为「最近可见作品」，不依赖滚动容器的实现细节。
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

test("纵向结构契约：七站按日期分组升序、同日续作短刻度、唯一尾站，横向控件与行者已删除", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  await expect(screen.getByRole("region", "作品时间轴")).toBeVisible();
  for (const [slug, name] of WORKS) {
    await expect(screen.getByRole("link", `打开${name}`)).toHaveAttribute("id", `portfolio-work-${slug}`);
  }
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const wrapper = document.querySelector("[data-portfolio-timeline]");
        const region = document.querySelector('[role="region"][aria-label="作品时间轴"]');
        const stops = [...document.querySelectorAll("li[data-timeline-stop]")];
        const end = document.querySelector("li[data-timeline-end]");
        const dates = [...document.querySelectorAll("li[data-timeline-stop] > time")].map(
          (time) => time.textContent?.trim() ?? "",
        );
        const datePattern = /^\d{4}\.\d{2}\.\d{2}$/u;
        const ascending = dates.every((date, index) => index === 0 || dates[index - 1]! < date);
        const continuations = [...document.querySelectorAll("li[data-continue]")];
        return {
          stopCount: stops.length,
          endCount: document.querySelectorAll("li[data-timeline-end]").length,
          dateGroupsAscending: dates.length === 6 && dates.every((date) => datePattern.test(date)) && ascending,
          continuationTicks:
            continuations.length === 1 &&
            continuations.every(
              (stop) => stop.querySelector("time") === null && stop.querySelector(":scope > span[aria-hidden='true']") !== null,
            ),
          endIsTail: Boolean(end && !end.querySelector("a") && !end.querySelector("time") && end.textContent?.includes("未完待续")),
          listInWrapper: Boolean(wrapper?.contains(document.querySelector("ol[data-timeline-list]") ?? null)),
          horizontalButtons: [...document.querySelectorAll("button")].filter((button) => {
            const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
            return name.includes("向前浏览作品") || name.includes("向后浏览作品");
          }).length,
          captionCount: document.querySelectorAll("[data-timeline-caption]").length,
          walkerCount: document.querySelectorAll("[data-portfolio-timeline] svg[aria-hidden='true'][viewBox='0 0 27 32']").length,
          regionFocusable: region?.getAttribute("tabindex") !== null,
        };
      }),
    )
    .toEqual({
      stopCount: 7,
      endCount: 1,
      dateGroupsAscending: true,
      continuationTicks: true,
      endIsTail: true,
      listInWrapper: true,
      horizontalButtons: 0,
      captionCount: 0,
      walkerCount: 0,
      regionFocusable: false,
    });
  // 方向键不被拦截：ArrowDown 仍原生滚动页面。
  await browser.keyboard.press("ArrowDown");
  await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("页面滚动更新唯一当前站，焦点不被挪动", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await expect(screen.getByRole("region", "作品时间轴")).toBeVisible();
  await expect.poll(() => activeStation(browser)).toBe("layout-compositions");
  await scrollToWork(browser, "personal-sites");
  await expect.poll(() => activeStation(browser)).toBe("personal-sites");
  await scrollToWork(browser, "ai-chat");
  await expect.poll(() => activeStation(browser)).toBe("ai-chat");
  expect(await browser.evaluate(() => document.querySelectorAll('li[data-active="true"]').length)).toBe(1);
  expect(await browser.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test("直接点击滚动到的作品能进入详情，链接保持被动", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await scrollToWork(browser, "muse");
  await screen.getByRole("link", "打开灵感集").tap();
  await expect(browser).toHaveURL(/\/products\/muse$/u);
});

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const) {
  test(`${width}×${height}：显式「返回作品集」原生锚点把出发作品带回视口`, async ({ app, screen, browser }) => {
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
    await expect.poll(() => activeStation(browser)).toBe("word-arcade");
  });
}

test("浏览器后退用原生滚动恢复离开时的阅读位置", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await scrollToWork(browser, "ai-chat");
  await expect.poll(() => activeStation(browser)).toBe("ai-chat");
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
  test(`${width}×${height}：站点沿纵列单调向下、列位稳定，页面与时间轴都不横向溢出`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height });
    await app.open("/portfolio");
    await expect(screen.getByRole("region", "作品时间轴")).toBeVisible();
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const wrapper = document.querySelector("[data-portfolio-timeline]");
          const stops = [...document.querySelectorAll("li[data-timeline-stop]")];
          const end = document.querySelector("li[data-timeline-end]");
          if (!wrapper || stops.length !== 7 || !end) return null;
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const innerSlack = wrapper.scrollHeight - wrapper.clientHeight;
          const rects = stops.map((stop) => stop.getBoundingClientRect());
          const lefts = rects.map((rect) => rect.left);
          let monotonicY = true;
          for (let index = 1; index < rects.length; index += 1) {
            if (rects[index]!.top <= rects[index - 1]!.top) monotonicY = false;
          }
          return {
            noHorizontalOverflow: overflow <= 0,
            noInnerVerticalScroll: innerSlack <= 0,
            columnAligned: Math.max(...lefts) - Math.min(...lefts) <= 1,
            monotonicY,
            // 基准态停靠以 padding 收尾，尾站与其紧邻（>=）即视为在其下方。
            endBelowLastStop: end.getBoundingClientRect().top >= rects[rects.length - 1]!.bottom,
          };
        }),
      )
      .toEqual({
        noHorizontalOverflow: true,
        noInnerVerticalScroll: true,
        columnAligned: true,
        monotonicY: true,
        endBelowLastStop: true,
      });
    if (width >= 1024) {
      const rail = await browser.locator(".curation-home__profile").boundingBox();
      const wrapperBox = await browser.locator("[data-portfolio-timeline]").boundingBox();
      expect(rail?.width ?? 0).toBeGreaterThan(200);
      expect(rail && wrapperBox ? rail.x + rail.width <= wrapperBox.x : false).toBe(true);
    }
  });
}
