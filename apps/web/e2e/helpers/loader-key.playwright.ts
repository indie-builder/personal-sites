import { test as base, expect, type Locator, type Page } from "@playwright/test";

export const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";

/** 全站 e2e 默认跳过 5s 开机仪式;需要真实播放开场加载的 spec 直接从 @playwright/test 导入。 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
    await use(page);
  },
});

export { expect, type Locator, type Page };
