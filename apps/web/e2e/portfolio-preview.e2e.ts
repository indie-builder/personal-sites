import { expect, test, type Browser } from "./helpers/loader-key.ts";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

// 预览契约：七个作品共用同一外框（等宽等高）；书脊等内容不溢出自己的框；
// 只有阅读线附近的当前站在播（[data-preview-station][data-preview-playing] 是资格探针）；
// 暂停后全部停播、内容保持可读；减少动态效果时静态呈现且播放控制禁用。
// 纵向时间轴用页面原生滚动，后段示例先滚入视口再断言。

// 把作品顶边对到视口 25% 处，让阅读线落在该站内容内成为当前站。
const scrollToWork = (browser: Browser, slug: string) =>
  browser.evaluate((target) => {
    const link = document.getElementById(`portfolio-work-${target}`);
    if (!link) return false;
    window.scrollTo({ top: link.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25 });
    return true;
  }, slug);

for (const width of [320, 390, 1440]) {
  test(`作品预览在 ${width}px 共用同一外框，暂停后全部停播且内容可读`, async ({ app, browser, screen }) => {
    await browser.setViewport({ width, height: 900 });
    await app.open("/portfolio");
    await screen.getByRole("button", "暂停预览").tap();
    await expect(screen.getByRole("button", "播放预览")).toBeVisible();
    await expect
      .poll(() => browser.evaluate(() => document.querySelectorAll("[data-preview-station][data-preview-playing='true']").length))
      .toBe(0);
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const frames = [...document.querySelectorAll("[data-preview-station]")];
          if (frames.length !== 7) return null;
          const heights = frames.map((frame) => frame.getBoundingClientRect().height);
          const widths = frames.map((frame) => frame.getBoundingClientRect().width);
          return Math.max(...heights) - Math.min(...heights) < 1 && Math.max(...widths) - Math.min(...widths) < 1;
        }),
      )
      .toBe(true);
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const frame = document.querySelector('[data-preview-station="layout-compositions"]');
          const link = document.querySelector('a[aria-label="打开布局参考"]');
          if (!frame || !link) return false;
          const boundary = frame.getBoundingClientRect();
          const books = [...link.querySelectorAll("[data-preview] > div > span")];
          return (
            books.length === 8 &&
            books.every((book) => {
              const rect = book.getBoundingClientRect();
              return (
                rect.left >= boundary.left &&
                rect.right <= boundary.right &&
                rect.top >= boundary.top &&
                rect.bottom <= boundary.bottom
              );
            })
          );
        }),
      )
      .toBe(true);
    await screen.getByRole("link", "打开AI 问答").scrollIntoView();
    await expect(screen.getByText("示例数据", { exact: true })).toBeVisible();
    const content = await browser.evaluate(() => {
      const preview = document.querySelector("[data-chat-preview]");
      return preview
        ? [...preview.querySelectorAll("strong,small,em")].every(
            (element) => getComputedStyle(element).visibility !== "hidden" && Number(getComputedStyle(element).opacity) > 0,
          )
        : false;
    });
    expect(content).toBe(true);
  });
}

test("播放资格随页面滚动移动到阅读线附近的作品", async ({ app, browser }) => {
  await browser.setViewport({ width: 1440, height: 900 });
  await app.open("/portfolio");
  const playingSlugs = () =>
    browser.evaluate(() =>
      [...document.querySelectorAll("[data-preview-station][data-preview-playing='true']")].map((element) =>
        element.getAttribute("data-preview-station"),
      ),
    );
  await expect.poll(playingSlugs).toEqual(["layout-compositions"]);
  await scrollToWork(browser, "ai-chat");
  await expect.poll(playingSlugs).toEqual(["ai-chat"]);
  await scrollToWork(browser, "muse");
  await expect.poll(playingSlugs).toEqual(["muse"]);
});

test("减少动态效果时预览全静态且播放控制禁用", async ({ app, browser, screen }) => {
  await emulateReducedMotion(browser);
  await app.open("/portfolio");
  const still = screen.getByRole("button", "静态预览");
  await expect(still).toBeVisible();
  await expect(still).toBeDisabled();
  await expect
    .poll(() => browser.evaluate(() => document.querySelectorAll("[data-preview-station][data-preview-playing='true']").length))
    .toBe(0);
});
