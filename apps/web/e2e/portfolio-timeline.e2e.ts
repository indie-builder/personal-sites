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

const timelineScrollLeft = (browser: Browser) =>
  browser.evaluate(() => document.getElementById("portfolio-timeline")?.scrollLeft ?? -1);

const captionText = (browser: Browser) =>
  browser.evaluate(() => document.querySelector("[data-timeline-caption]")?.textContent ?? "");

const stationIndex = (browser: Browser) =>
  browser.evaluate(() => {
    const station = document.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station") ?? "";
    return [
      "layout-compositions",
      "muse",
      "design-engineer-tools",
      "personal-sites",
      "ai-coding-dictionary",
      "ai-chat",
      "word-arcade",
      "future",
    ].indexOf(station);
  });

const structure = (browser: Browser) =>
  browser.evaluate(() => {
    const wrapper = document.querySelector("[data-portfolio-timeline]");
    const region = document.getElementById("portfolio-timeline");
    const stops = [...document.querySelectorAll("li[data-timeline-stop]")];
    const end = document.querySelector("li[data-timeline-end]");
    const caption = document.querySelector("[data-timeline-caption]");
    const activeStop = document.querySelector('li[data-active="true"]');
    const dates = stops.map((stop) => stop.querySelector("time")?.textContent?.trim() ?? "");
    const walkerVisible = (stop: Element) => {
      const walker = stop.querySelector("svg[aria-hidden='true'][viewBox='0 0 27 32']");
      if (!walker) return false;
      const style = getComputedStyle(walker);
      return style.visibility !== "hidden" && Number(style.opacity) > 0 && walker.getClientRects().length > 0;
    };
    return {
      hasRegion: Boolean(wrapper?.contains(region)),
      stopCount: stops.length,
      endCount: document.querySelectorAll("li[data-timeline-end]").length,
      dates,
      sameDayDates: dates.filter((date) => date === "2026.09.03").length,
      activeStation: wrapper?.getAttribute("data-active-station") ?? "",
      activeCount: document.querySelectorAll('li[data-active="true"]').length,
      endIsTail: Boolean(end && !end.querySelector("a") && end.textContent?.includes("未完待续")),
      listInRegion: Boolean(region?.contains(document.querySelector("ol[data-timeline-list]") ?? null)),
      captionOutsideRegion: Boolean(caption && region && !region.contains(caption) && caption.textContent?.includes("布局参考")),
      walkerOnActive: activeStop ? walkerVisible(activeStop) : false,
      walkerVisibleElsewhere: [...document.querySelectorAll("li[data-timeline-stop], li[data-timeline-end]")].filter(
        (stop) => stop !== activeStop && walkerVisible(stop),
      ).length,
    };
  });

test("时间轴结构：七站加未完待续尾站，每站显示真实日期，行者只随当前站", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  await expect(screen.getByRole("region", "作品时间轴")).toBeVisible();
  for (const [slug, name] of WORKS) {
    await expect(screen.getByRole("link", `打开${name}`)).toHaveAttribute("id", `portfolio-work-${slug}`);
  }
  await expect.poll(() => structure(browser)).toEqual({
    hasRegion: true,
    stopCount: 7,
    endCount: 1,
    dates: ["2026.09.03", "2026.09.03", "2026.09.04", "2026.09.09", "2026.09.25", "2026.09.26", "2026.09.29"],
    sameDayDates: 2,
    activeStation: "layout-compositions",
    activeCount: 1,
    endIsTail: true,
    listInRegion: true,
    captionOutsideRegion: true,
    walkerOnActive: true,
    walkerVisibleElsewhere: 0,
  });
});

test("前后按钮以原生禁用表达边界，推进时说明与行者跟随当前站", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  const previous = screen.getByRole("button", "向前浏览作品");
  const next = screen.getByRole("button", "向后浏览作品");
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  for (const [slug, name] of WORKS.slice(1)) {
    await next.tap();
    await expect.poll(() => activeStation(browser)).toBe(slug);
    await expect.poll(() => captionText(browser)).toContain(name);
    if (slug === "muse") {
      await expect.poll(() => structure(browser)).toMatchObject({
        activeStation: "muse",
        walkerOnActive: true,
        walkerVisibleElsewhere: 0,
      });
    }
  }
  await next.tap();
  await expect.poll(() => activeStation(browser)).toBe("future");
  await expect.poll(() => captionText(browser)).toContain("未完待续");
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
});

test("快速连按右方向键持续推进，而不是重复同一目标", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  const region = screen.getByRole("region", "作品时间轴");
  await region.focus();
  await region.press("ArrowRight");
  await region.press("ArrowRight");
  await region.press("ArrowRight");
  await expect.poll(() => activeStation(browser)).toBe("personal-sites");
  await expect.poll(() => timelineScrollLeft(browser)).toBeGreaterThan(0);
});

test("方向键在链接间移动焦点，End 到尾站，Tab 仍是普通链接停靠并选中当前站", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  const region = screen.getByRole("region", "作品时间轴");
  await region.focus();
  await region.press("End");
  await expect(region).toBeFocused();
  await expect.poll(() => activeStation(browser)).toBe("future");
  await region.press("Tab");
  await expect(screen.getByRole("link", "打开布局参考")).toBeFocused();
  await expect.poll(() => activeStation(browser)).toBe("layout-compositions");
  await screen.getByRole("link", "打开布局参考").press("ArrowRight");
  await expect(screen.getByRole("link", "打开灵感集")).toBeFocused();
  await expect.poll(() => activeStation(browser)).toBe("muse");
  await screen.getByRole("link", "打开灵感集").press("Home");
  await expect.poll(() => activeStation(browser)).toBe("layout-compositions");
  await expect.poll(() => timelineScrollLeft(browser)).toBe(0);
  await expect(screen.getByRole("button", "向前浏览作品")).toBeDisabled();
});

test("直接点击首屏相邻可见作品能进入详情，不在按下时移走链接", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  await screen.getByRole("link", "打开灵感集").tap();
  await expect(browser).toHaveURL(/\/products\/muse$/u);
});

test("真实鼠标从作品链接上拖动横移不触发导航，随后点击仍可进入作品", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  await screen.getByRole("button", "向后浏览作品").tap();
  const link = screen.getByRole("link", "打开灵感集");
  await expect.poll(() => activeStation(browser)).toBe("muse");
  const box = await link.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  const beforeDrag = await timelineScrollLeft(browser);
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await browser.mouse.move(startX, y);
  await browser.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await browser.mouse.move(startX - step * 20, y);
  }
  await browser.mouse.up();
  await expect(browser).toHaveURL(/\/portfolio$/u);
  await expect.poll(() => timelineScrollLeft(browser)).toBeGreaterThan(beforeDrag + 40);
  await expect
    .poll(() => browser.evaluate(() => document.getElementById("portfolio-timeline")?.getAttribute("data-dragging") ?? ""))
    .toBe("");
  await link.tap();
  await expect(browser).toHaveURL(/\/products\/muse$/u);
});

test("横向滚轮交给时间轴并更新当前站，纵向滚轮仍滚动页面", async ({ app, screen, browser }) => {
  await browser.setViewport({ width: 390, height: 320 });
  await app.open("/portfolio");
  const box = await screen.getByRole("region", "作品时间轴").boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  await browser.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await browser.mouse.wheel(600, 0);
  await expect.poll(() => timelineScrollLeft(browser)).toBeGreaterThan(100);
  await expect.poll(() => stationIndex(browser)).toBeGreaterThan(0);
  await browser.mouse.wheel(0, 600);
  await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("浏览器后退恢复后段作品的横向位置与链接焦点", async ({ app, screen, browser }) => {
  await app.open("/portfolio#portfolio-work-muse");
  const region = screen.getByRole("region", "作品时间轴");
  await region.focus();
  await region.press("End");
  await region.press("ArrowLeft");
  await expect.poll(() => activeStation(browser)).toBe("word-arcade");
  const link = screen.getByRole("link", "打开文字游乐场");
  await link.focus();
  await browser.evaluate(() => {
    const region = document.getElementById("portfolio-timeline");
    if (region) region.scrollLeft += 45;
    return region?.scrollLeft ?? 0;
  });
  const left = await timelineScrollLeft(browser);
  expect(left).toBeGreaterThan(0);
  await link.press("Enter");
  await expect(browser).toHaveURL(/\/products\/word-arcade$/u);
  await browser.back();
  await expect(browser).toHaveURL(/\/portfolio#portfolio-work-muse$/u);
  await expect.poll(() => activeStation(browser)).toBe("word-arcade");
  await expect.poll(() => timelineScrollLeft(browser)).toBeCloseTo(left, 0);
  await expect(link).toBeFocused();
});

test("显式「返回作品集」回到出发作品并恢复横向位置与焦点", async ({ app, screen, browser }) => {
  await app.open("/portfolio");
  const region = screen.getByRole("region", "作品时间轴");
  await region.focus();
  await region.press("End");
  await region.press("ArrowLeft");
  await region.press("ArrowLeft");
  await expect.poll(() => activeStation(browser)).toBe("ai-chat");
  const link = screen.getByRole("link", "打开AI 问答");
  await link.focus();
  const left = await timelineScrollLeft(browser);
  expect(left).toBeGreaterThan(0);
  await link.tap();
  await expect(browser).toHaveURL(/\/products\/ai-chat$/u);
  const backLink = screen.getByRole("link", "返回作品集");
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/portfolio#portfolio-work-ai-chat");
  await backLink.tap();
  await expect(browser).toHaveURL(/\/portfolio#portfolio-work-ai-chat$/u);
  await expect.poll(() => activeStation(browser)).toBe("ai-chat");
  await expect(link).toBeFocused();
  await expect.poll(() => timelineScrollLeft(browser)).toBeCloseTo(left, 0);
});

test("直达详情页后的「返回作品集」对齐哈希指向的作品", async ({ app, screen, browser }) => {
  await app.open("/products/muse");
  await screen.getByRole("link", "返回作品集").tap();
  await expect(browser).toHaveURL(/\/portfolio#portfolio-work-muse$/u);
  await expect.poll(() => activeStation(browser)).toBe("muse");
  await expect(screen.getByRole("link", "打开灵感集")).toBeFocused();
  await expect.poll(() => timelineScrollLeft(browser)).toBeGreaterThan(0);
});

const VIEWPORTS = [
  { width: 320, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

for (const { width, height } of VIEWPORTS) {
  test(`${width}×${height}：文档不横向溢出，当前站完整可见并留下一站提示`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height });
    await app.open("/portfolio");
    await expect(screen.getByRole("region", "作品时间轴")).toBeVisible();
    await expect
      .poll(() => browser.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(0);
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const region = document.getElementById("portfolio-timeline");
          const stops = document.querySelectorAll("li[data-timeline-stop]");
          const activeStop = document.querySelector('li[data-active="true"]');
          if (!region || stops.length !== 7 || !activeStop) return null;
          const viewport = region.getBoundingClientRect();
          const activeRect = activeStop.getBoundingClientRect();
          const second = stops[1].getBoundingClientRect();
          return {
            activeInside: activeRect.left >= viewport.left - 0.5 && activeRect.right <= viewport.right + 0.5,
            nextCue: second.left < viewport.right - 0.5,
          };
        }),
      )
      .toEqual({ activeInside: true, nextCue: true });
    if (width >= 1024) {
      const rail = await browser.locator(".curation-home__profile").boundingBox();
      const regionBox = await browser.locator("#portfolio-timeline").boundingBox();
      expect(rail?.width ?? 0).toBeGreaterThan(200);
      expect(rail && regionBox ? rail.x + rail.width <= regionBox.x : false).toBe(true);
    }
  });
}
