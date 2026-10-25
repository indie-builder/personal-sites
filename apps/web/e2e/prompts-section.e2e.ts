import { expect, test } from "./helpers/loader-key.ts";

const TAG = "软件工程提示词";

// 提示词栏目：刊头入口、开放标签筛选（URL 状态）与详情返回，四个尺寸都走同一条路径。
for (const width of [1_440, 390, 320, 844]) {
  test(`prompts section entry, tag filter and detail return at ${width}px`, async ({ app, browser, screen }) => {
    await browser.setViewport({ height: width === 844 ? 390 : 900, width });
    await app.open("/prompts");

    // 入口：可见的内容导航把提示词标为当前版块（桌面为当前刊名、手机为当前链接）。
    const currentSections = await browser.evaluate(() => {
      const navs = Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="内容导航"]'))
        .filter((nav) => nav.getClientRects().length > 0 && getComputedStyle(nav).visibility !== "hidden");
      return navs.flatMap((nav) => Array.from(nav.querySelectorAll('[aria-current="page"]'), (element) => element.textContent?.trim()));
    });
    expect(currentSections).toContain("提示词");

    const entries = browser.locator(".curation-home__stream li a[data-content-id]");
    await expect(entries.first()).toBeVisible();
    const payload = await (await fetch(new URL("/api/prompts", app.baseUrl))).json() as { items: { id: string }[] };
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);

    // 摘录式条目：正文直接可读、可就地复制，长正文默认折叠到 12 行。
    await expect(browser.locator(".prompt-entry").first()).toBeVisible();
    await expect(browser.locator(".prompt-copy").first()).toBeVisible();
    const promptBox = await browser.evaluate(() => {
      const pre = document.querySelector(".prompt-entry__prompt pre");
      return pre ? { collapsed: pre.getAttribute("data-collapsed"), chars: pre.textContent?.length ?? 0 } : null;
    });
    expect(promptBox?.chars).toBeGreaterThan(0);
    if (promptBox?.collapsed === "true") {
      // 多个长条目各有展开按钮；按 DOM 位置锁定第一条，避免按钮文案变化后重新匹配到别的条目。
      const toggle = browser.locator("xpath=(//article[contains(@class,'prompt-entry')])[1]//button[@aria-expanded]");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }

    // 开放标签筛选：菜单来自提示词子集，选中后筛选状态写进 URL。
    await screen.getByRole("button", "筛选提示词：全部主题", { exact: false }).click();
    await screen.getByRole("menuitemradio", new RegExp(`^${TAG} · `, "u")).click();
    await expect(screen.getByRole("button", `筛选提示词：${TAG}`, { exact: false })).toBeVisible();
    await expect.poll(async () => new URL(await browser.url()).searchParams.get("tag")).toBe(TAG);
    const filtered = await (await fetch(new URL(`/api/prompts?tag=${encodeURIComponent(TAG)}`, app.baseUrl))).json() as { items: { id: string }[] };
    await expect(entries.first()).toHaveAttribute("data-content-id", filtered.items[0].id);
    const streamTags = await browser.evaluate(() => Array.from(
      document.querySelectorAll(".curation-home__stream-tags"),
      (element) => element.textContent ?? "",
    ));
    expect(streamTags.every((text) => text.includes(TAG))).toBe(true);

    // 详情返回：提示词详情走 /prompts/<id>，返回链接回到栏目。
    await entries.first().click();
    await expect(browser).toHaveURL(new RegExp(`/prompts/${filtered.items[0].id}$`, "u"));
    await expect(screen.getByRole("region", "原始内容", { exact: true })).toBeVisible();
    // 译文与追评只在公开数据实际存在时显示；缺失时保留原帖和解析，不渲染空区域。
    const bilingual = await (await fetch(new URL(`/curation/${filtered.items[0].id}`, app.baseUrl))).text();
    const hasTranslation = bilingual.includes('aria-label="中文译文"');
    if (hasTranslation) await expect(screen.getByRole("region", "中文译文", { exact: true })).toBeVisible();
    else expect(bilingual).toContain('aria-label="深度解析"');
    expect(await browser.evaluate(() => Boolean(
      document.querySelector('section[aria-label="原始内容"] blockquote p')
      && getComputedStyle(document.querySelector('section[aria-label="原始内容"] blockquote p')!).whiteSpace === "pre-wrap"
      && document.querySelectorAll('.curation-detail__tags a[href^="/prompts"]').length > 0,
    ))).toBe(true);
    await screen.getByRole("link", "返回提示词", { exact: false }).click();
    await expect(browser).toHaveURL(/\/prompts$/u);
    await expect(entries.first()).toHaveAttribute("data-content-id", payload.items[0].id);
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
