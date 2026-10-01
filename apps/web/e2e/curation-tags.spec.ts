import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320, 844]) {
  test(`curation prompt filtering and detail return at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/curation");
    await page.getByRole("button", { name: "筛选每日关注：全部主题" }).click();
    const promptOption = page.getByRole("menuitemradio", { name: /^提示词 · /u });
    await expect(promptOption).toBeVisible();
    expect(await page.getByRole("menu").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
    await promptOption.click();
    const promptButton = page.getByRole("button", { name: "筛选每日关注：提示词" });
    await expect(promptButton).toBeVisible();
    const entries = page.locator(".curation-home__stream li a[data-content-id]");
    await expect(entries.first()).toBeVisible();
    const payload = await (await request.get("/api/curation?tag=提示词")).json();
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);
    expect(await page.locator(".curation-home__stream-tags").allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining("提示词")]));
    expect((await page.locator(".curation-home__stream-tags").allTextContents()).every((text) => text.includes("提示词"))).toBe(true);

    await entries.first().click();
    await expect(page).toHaveURL(/\/curation\/\d+$/u);
    await page.getByRole("link", { name: "返回每日关注" }).click();
    await expect(promptButton).toBeVisible();
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);
    for (const tag of ["视频提示词", "软件工程提示词", "图像提示词", "写作提示词", "学习提示词", "研究提示词", "助手提示词"]) {
      await page.getByRole("button", { name: /^筛选每日关注：/u }).click();
      await page.getByRole("menuitemradio", { name: new RegExp(`^${tag} · `, "u") }).click();
      await expect(page.getByRole("button", { name: `筛选每日关注：${tag}` })).toBeVisible();
      const filtered = await (await request.get(`/api/curation?tag=${encodeURIComponent(tag)}`)).json();
      await expect(entries.first()).toHaveAttribute("data-content-id", filtered.items[0].id);
      expect((await page.locator(".curation-home__stream-tags").allTextContents()).every((text) => text.includes(tag))).toBe(true);
    }
    await page.getByRole("button", { name: /^筛选每日关注：/u }).click();
    await page.getByRole("menuitemradio", { name: /^提示词 · /u }).click();
    await expect(promptButton).toBeVisible();
    await promptButton.click();
    await page.getByRole("menuitemradio", { name: /^技能 · /u }).click();
    const skillButton = page.getByRole("button", { name: "筛选每日关注：技能" });
    await expect(skillButton).toBeVisible();
    const skills = await (await request.get("/api/curation?tag=技能")).json();
    await expect(entries.first()).toHaveAttribute("data-content-id", skills.items[0].id);
    expect((await page.locator(".curation-home__stream-tags").allTextContents()).every((text) => text.includes("技能"))).toBe(true);
    await skillButton.click();
    await page.getByRole("menuitemradio", { name: "全部主题", exact: true }).click();
    await expect(page.getByRole("button", { name: "筛选每日关注：全部主题" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
