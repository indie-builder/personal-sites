import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

for (const width of [1440, 390, 320, 844]) {
  test(`open-source topic menu filters at ${width}px`, async ({ app, screen, browser }) => {
    await browser.setViewport({ width, height: width === 844 ? 390 : 900 });
    // 前置调整（非等价）：旧版 emulateMedia reduce 同时停掉 CSS @media 降级块（列表入场动画）；
    // 引擎不模拟该媒体特性，补丁只让 JS 现读生效（过滤 stagger 不播）。列表 CSS 动画仍会播放，
    // 本用例的计数、菜单状态、文本与溢出断言不依赖它。
    await emulateReducedMotion(browser);
    await app.open("/open-source");
    // 旧 section.locator("ol > li") 的 region 作用域用同属性选择器展开（section 页面唯一）。
    const rows = browser.locator('[aria-label="已判读的开源项目"] ol > li');
    const total = await rows.count();
    const trigger = screen.getByRole("button", "筛选开源关注：全部主题", { exact: false });
    await expect(trigger).toBeVisible();
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const menu = screen.getByRole("menu");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect(menu.getByRole("menuitemradio", `全部主题 · ${total}`)).toHaveAttribute("data-state", "checked");
    const skills = menu.getByRole("menuitemradio", /^Skills 与工作流 · /u);
    const count = Number((await skills.textContent())!.split(" · ").at(-1));
    await skills.click();
    await expect(menu).toBeHidden();
    const selected = screen.getByRole("button", "筛选开源关注：Skills 与工作流", { exact: false });
    await expect(selected).toBeVisible();
    await expect(rows).toHaveCount(count);
    await expect(browser.locator('[aria-label="已判读的开源项目"] .stream-date-toolbar')).toContainText(`${count} 个项目`);
    // 框架 locator.allTextContents 对 content-visibility 跳过的屏外条目返回空串；页内读
    // textContent 与旧 Playwright 实测值一致（curation-tags 先例）。选择器沿用旧链展开。
    expect(await browser.evaluate(() => {
      const sections = document.querySelectorAll('[aria-label="已判读的开源项目"]');
      if (sections.length !== 1) throw new Error(`expected exactly one open-source section, found ${sections.length}`);
      return Array.from(sections[0].querySelectorAll("ol > li a > div:first-child > span:first-child"), (span) => span.textContent);
    })).toEqual(Array(count).fill("Skills 与工作流"));
    await expect(selected).toBeFocused();
    await browser.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("data-state", "open");
    await expect(skills).toHaveAttribute("data-state", "checked");
    await browser.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(selected).toBeFocused();
    await selected.click();
    await menu.getByRole("menuitemradio", `全部主题 · ${total}`).click();
    await expect(rows).toHaveCount(total);
    await expect(trigger).toBeVisible();
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
