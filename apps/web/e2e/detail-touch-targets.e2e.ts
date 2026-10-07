import type { Browser } from "@e2e-dev/web";
import { expect, test, type Locator } from "./helpers/loader-key.ts";

const MOBILE_VIEWPORT = { height: 844, width: 390 };
const DESKTOP_VIEWPORT = { height: 900, width: 1_440 };

async function expectTouchTargets(controls: Locator) {
  await expect(controls.first()).toBeVisible();
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectDesktopDensity(controls: Locator) {
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(44);
  }
}

async function expectNoHorizontalOverflow(browser: Browser) {
  expect(await browser.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
}

test("AI news detail gives the back link and original-source CTA mobile touch targets", async ({ app, browser }) => {
  await browser.setViewport(MOBILE_VIEWPORT);
  await app.open("/ai-news");
  const detailPath = await browser.locator(".ai-news__entry").first().getAttribute("href");
  expect(detailPath).toMatch(/^\/ai-news\//u);
  await app.open(detailPath!);

  const controls = browser.locator(".ai-news-detail__back, .ai-news-detail__cta");
  await expectTouchTargets(controls);
  await expectNoHorizontalOverflow(browser);

  await browser.setViewport(DESKTOP_VIEWPORT);
  await expectDesktopDensity(controls);
});

test("curation detail gives its return link a mobile touch target", async ({ app, screen, browser }) => {
  await browser.setViewport(MOBILE_VIEWPORT);
  await app.open("/curation/2093968800316293400");

  const back = screen.getByRole("link", "返回每日关注", { exact: false });
  await expectTouchTargets(back);
  await expectNoHorizontalOverflow(browser);

  await browser.setViewport(DESKTOP_VIEWPORT);
  await expectTouchTargets(back);
});

test("open-source document tabs and GitHub CTA keep sticky, dark mobile controls", async ({ app, screen, browser }) => {
  await browser.setViewport(MOBILE_VIEWPORT);
  await app.open("/open-source");
  await browser.locator('a[href^="/open-source/"]').first().click();

  const tabs = screen.getByRole("tab");
  const github = screen.getByRole("link", /在 GitHub 查看仓库/u);
  await expectTouchTargets(tabs);
  await expectTouchTargets(github);
  // 旧 getByRole("heading", "仓库文档").locator("..") 的标题名 + 父级读取：页内按同名标题
  // 单匹配取父元素（子串语义），computed style 轮询替代 toHaveCSS 的重试。
  const readDocumentHeaderStyle = () => browser.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .filter((heading) => heading.textContent?.includes("仓库文档"));
    if (headings.length !== 1) throw new Error(`expected exactly one 仓库文档 heading, found ${headings.length}`);
    const header = headings[0].parentElement;
    if (!header) throw new Error("仓库文档 heading has no parent");
    return {
      backgroundColor: getComputedStyle(header).backgroundColor,
      borderBottomWidth: getComputedStyle(header).borderBottomWidth,
      position: getComputedStyle(header).position,
    };
  });
  await expect.poll(async () => (await readDocumentHeaderStyle()).position).toBe("sticky");
  await expect.poll(async () => (await readDocumentHeaderStyle()).borderBottomWidth).toBe("1px");

  await screen.getByRole("button", /切换为.+主题/u).click();
  await expect(browser.locator("html")).toHaveAttribute("data-curation-theme", "dark");
  await expectTouchTargets(tabs);
  await expectTouchTargets(github);
  await expect.poll(async () => (await readDocumentHeaderStyle()).backgroundColor).toBe("rgb(24, 24, 24)");
  await expectNoHorizontalOverflow(browser);

  await browser.setViewport(DESKTOP_VIEWPORT);
  await expectDesktopDensity(tabs);
  await expectDesktopDensity(github);
});
