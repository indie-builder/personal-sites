import { expect, test } from "./helpers/loader-key.ts";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

for (const width of [1440, 390, 320, 844]) {
  test(`curation prompt filtering and detail return at ${width}px`, async ({ app, browser, screen }) => {
    await browser.setViewport({ width, height: width === 844 ? 390 : 900 });
    // 旧 emulateMedia({ reducedMotion }) 框架未实现：补丁让本页起的 matchMedia 调用读到 reduce。
    await emulateReducedMotion(browser);
    await app.open("/curation");
    // 旧 emulateMedia 连带禁用了菜单开合 CSS 动画（profile.css 的 reduce 块）；框架改不了
    // CSS 媒体特性，注入同款规则保住菜单几何断言的确定性。
    await browser.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ".ai-news__category-menu { animation: none; }";
      document.head.appendChild(style);
      return null;
    });
    await screen.getByRole("button", "筛选每日关注：全部主题", { exact: false }).click();
    const promptOption = screen.getByRole("menuitemradio", /^提示词 · /u);
    await expect(promptOption).toBeVisible();
    expect(await browser.evaluate(() => {
      const menus = document.querySelectorAll('[role="menu"]');
      if (menus.length !== 1) throw new Error(`expected exactly one menu, found ${menus.length}`);
      return menus[0].getBoundingClientRect().right;
    })).toBeLessThanOrEqual(width);
    await promptOption.click();
    const promptButton = screen.getByRole("button", "筛选每日关注：提示词", { exact: false });
    await expect(promptButton).toBeVisible();
    const entries = browser.locator(".curation-home__stream li a[data-content-id]");
    await expect(entries.first()).toBeVisible();
    const payload = await (await fetch(new URL("/api/curation?tag=提示词", app.baseUrl))).json() as { items: { id: string }[] };
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);
    // 框架 locator.allTextContents 对 content-visibility 跳过的屏外条目返回空串；
    // 改用页内 textContent 逐项读取，与旧 Playwright allTextContents 的实测值一致。
    const readStreamTags = () => browser.evaluate(() => Array.from(
      document.querySelectorAll(".curation-home__stream-tags"),
      (element) => element.textContent ?? "",
    ));
    expect(await readStreamTags()).toEqual(expect.arrayContaining([expect.stringContaining("提示词")]));
    expect((await readStreamTags()).every((text) => text.includes("提示词"))).toBe(true);

    await entries.first().click();
    await expect(browser).toHaveURL(/\/curation\/\d+$/u);
    await screen.getByRole("link", "返回每日关注", { exact: false }).click();
    await expect(promptButton).toBeVisible();
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);
    for (const tag of ["视频提示词", "软件工程提示词", "图像提示词", "写作提示词", "学习提示词", "研究提示词", "助手提示词"]) {
      await screen.getByRole("button", /^筛选每日关注：/u).click();
      await screen.getByRole("menuitemradio", new RegExp(`^${tag} · `, "u")).click();
      await expect(screen.getByRole("button", `筛选每日关注：${tag}`, { exact: false })).toBeVisible();
      const filtered = await (await fetch(new URL(`/api/curation?tag=${encodeURIComponent(tag)}`, app.baseUrl))).json() as { items: { id: string }[] };
      await expect(entries.first()).toHaveAttribute("data-content-id", filtered.items[0].id);
      expect((await readStreamTags()).every((text) => text.includes(tag))).toBe(true);
    }
    await screen.getByRole("button", /^筛选每日关注：/u).click();
    await screen.getByRole("menuitemradio", /^提示词 · /u).click();
    await expect(promptButton).toBeVisible();
    await promptButton.click();
    await screen.getByRole("menuitemradio", /^技能 · /u).click();
    const skillButton = screen.getByRole("button", "筛选每日关注：技能", { exact: false });
    await expect(skillButton).toBeVisible();
    const skills = await (await fetch(new URL("/api/curation?tag=技能", app.baseUrl))).json() as { items: { id: string }[] };
    await expect(entries.first()).toHaveAttribute("data-content-id", skills.items[0].id);
    expect((await readStreamTags()).every((text) => text.includes("技能"))).toBe(true);
    await skillButton.click();
    await screen.getByRole("menuitemradio", "全部主题", { exact: true }).click();
    await expect(screen.getByRole("button", "筛选每日关注：全部主题", { exact: false })).toBeVisible();
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
