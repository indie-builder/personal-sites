import { expect, test } from "./helpers/loader-key.ts";

test("site stays light-only even with a legacy stored dark theme and renders no toggle", async ({ app, browser }) => {
  await browser.addInitScript(() => window.localStorage.setItem("curation-theme", "dark"));
  await app.open("/curation");
  await expect(browser.locator("main")).toBeVisible();

  // 旧版存储的深色偏好不再生效：无主题属性、底面保持浅色。
  expect(await browser.evaluate(() => document.documentElement.dataset.curationTheme ?? null)).toBe(null);
  await expect.poll(() => browser.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");

  // 主题切换按钮已删除：列表与详情都不再渲染。
  await expect(browser.locator(".curation-theme-toggle")).toHaveCount(0);

  const detailLink = browser.locator('.curation-home__feed a[href^="/curation/"]').first();
  // 列表同样经流式骨架进场：等首条详情链接渲染出来再导航。
  await expect.poll(async () => await browser.locator('.curation-home__feed a[href^="/curation/"]').count()).toBeGreaterThan(0);
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref ?? "", "列表必须渲染剪报详情链接").toMatch(/^\/curation\//u);
  await detailLink.click();
  await expect(browser).toHaveURL(new RegExp(`${detailHref}$`, "u"));
  await expect(browser.locator("article h1")).toBeVisible();
  await expect(browser.locator(".curation-theme-toggle")).toHaveCount(0);
  expect(await browser.evaluate(() => document.documentElement.dataset.curationTheme ?? null)).toBe(null);
});

test("About dialog shows the biography, dismisses on Escape, returns focus, and releases background scroll", async ({ app, screen, browser }) => {
  await app.open("/curation");
  const trigger = screen.getByRole("button", "关于我", { exact: false });
  await trigger.click();

  const dialog = screen.getByRole("dialog", "关于我：个人经历打印稿", { exact: false });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("陈远 / CHEN YUAN", { exact: false })).toBeVisible();
  await expect(dialog.getByText("合计 TOTAL", { exact: false })).toBeVisible();
  expect(await browser.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

  await browser.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => browser.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");

  // html 的 scroll-behavior:smooth 会被滚动容器继承，普通赋值走平滑动画，poll 反复重置永远到不了位，必须 instant。
  await expect.poll(() => browser.evaluate(() => {
    const feed = document.querySelector(".curation-home__feed");
    if (feed instanceof HTMLElement && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)) {
      feed.scrollTo({ behavior: "instant", top: 400 });
      return feed.scrollTop;
    }
    window.scrollTo({ behavior: "instant", top: 400 });
    return window.scrollY;
  })).toBeGreaterThan(0);
});
