import type { Browser } from "@e2e-dev/web";

// e2e 框架没有 emulateMedia({ reducedMotion })（文档列为 missing），web 引擎也不模拟
// prefers-reduced-motion。改写 matchMedia 只让此后的调用读到 reduce：不改变 CSS
// @media (prefers-reduced-motion) 规则，也不更新已创建的 MediaQueryList 或派发
// change 事件。站内所有动效门控（开屏仪式、档案摊开入场、桌面刊头跳转、问答弹层）
// 都在事件处理里现读 matchMedia，故对本站与 emulateMedia 等价。
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
