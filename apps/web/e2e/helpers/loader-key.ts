import { test as base } from "@e2e-dev/web";
import { expect } from "e2e";
import type { Browser } from "@e2e-dev/web";

export const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";

/**
 * 全站 e2e 默认跳过 5s 开机仪式；需要真实播放开场加载的用例直接从 @e2e-dev/web 导入 test。
 * 框架不允许覆写既有 fixture，这里以附加 fixture 注册 init script：
 * 经由本 test 注册的用例无论是否解构该 fixture，每个 attempt 在 hooks/body 前都会执行其 setup。
 */
export const test = base.extend({
  openingLoaderPlayed: async ({ browser }, use) => {
    await browser.addInitScript((key: string) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
    await use(undefined);
  },
});

export { expect };
export type { Locator, Screen } from "e2e";
export type { Browser };
