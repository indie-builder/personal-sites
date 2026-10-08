import type { Browser } from "@e2e-dev/web";
import { expect, test } from "./helpers/loader-key.ts";

async function readTheme(browser: Browser) {
  return browser.evaluate(() => ({
    dataset: document.documentElement.dataset.curationTheme ?? null,
    stored: window.localStorage.getItem("curation-theme"),
  }));
}

const labelFor = (theme: string | null) => (theme === "dark" ? "切换为浅色主题" : "切换为深色主题");
const flip = (theme: string | null) => (theme === "dark" ? "light" : "dark");

test("theme toggle persists across client navigation, reload, and toggles back", async ({ app, screen, browser }) => {
  await app.open("/curation");
  const initial = (await readTheme(browser)).dataset;
  await expect(screen.getByRole("button", labelFor(initial), { exact: false })).toBeVisible();

  await screen.getByRole("button", labelFor(initial), { exact: false }).click();
  const switched = flip(initial);
  await expect.poll(async () => (await readTheme(browser)).dataset).toBe(switched);
  expect((await readTheme(browser)).stored).toBe(switched);
  await expect(screen.getByRole("button", labelFor(switched), { exact: false })).toBeVisible();

  const detailLink = browser.locator('.curation-home__feed a[href^="/curation/"]').first();
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref ?? "", "列表必须渲染剪报详情链接").toMatch(/^\/curation\//u);
  await detailLink.click();
  await expect(browser).toHaveURL(new RegExp(`${detailHref}$`, "u"));
  await expect(browser.locator("article h1")).toBeVisible();
  const detailTitle = (await browser.locator("article h1").textContent())?.trim() ?? "";
  expect(detailTitle, "详情标题必须非空").not.toBe("");
  await expect.poll(async () => (await readTheme(browser)).dataset).toBe(switched);
  await expect(screen.getByRole("button", labelFor(switched), { exact: false })).toBeVisible();

  await browser.reload();
  await expect(browser).toHaveURL(new RegExp(`${detailHref}$`, "u"));
  await expect(browser.locator("article h1")).toHaveText(detailTitle);
  await expect.poll(async () => (await readTheme(browser)).dataset).toBe(switched);
  expect((await readTheme(browser)).stored).toBe(switched);
  const toggle = screen.getByRole("button", labelFor(switched), { exact: false });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect.poll(async () => (await readTheme(browser)).dataset).toBe(initial);
  expect((await readTheme(browser)).stored).toBe(initial);
  await expect(screen.getByRole("button", labelFor(initial), { exact: false })).toBeVisible();
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
