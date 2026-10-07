import type { Browser } from "@e2e-dev/web";

// e2e 框架没有 emulateMedia({ reducedMotion })（文档列为 missing），web 引擎也不模拟
// prefers-reduced-motion。站内所有动效门控（开屏仪式、档案摊开入场、桌面刊头跳转、
// 问答弹层）都经 window.matchMedia 判定，改写 matchMedia 即等价复现 reduce；
// CSS @media (prefers-reduced-motion) 规则不受影响——它们只关停 hover/骨架屏等
// 瞬态过渡，不产生 axe 会测到的入场中途态。
function patchMatchMediaForReducedMotion() {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const mql = nativeMatchMedia(query);
    if (!mql.matches && /prefers-reduced-motion:\s*reduce/.test(query)) {
      return {
        media: mql.media,
        matches: true,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    }
    return mql;
  };
  return null;
}

/** 下一份文档起 reduce：等价于 Playwright 在 goto 前调用 emulateMedia。 */
export async function emulateReducedMotion(browser: Browser) {
  await browser.addInitScript(patchMatchMediaForReducedMotion);
}

/** 当前文档立即 reduce：客户端导航不换文档，等价于测试中途调用 emulateMedia。 */
export async function emulateReducedMotionNow(browser: Browser) {
  await browser.evaluate<null>(`(${patchMatchMediaForReducedMotion.toString()})`);
}
