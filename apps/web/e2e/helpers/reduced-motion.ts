import type { Browser } from "@e2e-dev/web";

// e2e 框架没有 emulateMedia({ reducedMotion })（文档列为 missing），web 引擎也不模拟
// prefers-reduced-motion。改写 matchMedia 只让此后的调用读到 reduce：不改变 CSS
// @media (prefers-reduced-motion) 规则，也不更新已创建的 MediaQueryList 或派发
// change 事件。现有用例只依赖两处现读场景（初始化补丁、栏目点击事件内的门控判定）；
// useReducedMotion 等既有订阅不受补丁影响，新增依赖它们的用例需另行处理。
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

/** 下一份文档起让此后的 matchMedia 调用读到 reduce；涵盖范围见文件头注释。 */
export async function emulateReducedMotion(browser: Browser) {
  await browser.addInitScript(patchMatchMediaForReducedMotion);
}

/** 当前文档立即 reduce（客户端导航不换文档）；涵盖范围见文件头注释。 */
export async function emulateReducedMotionNow(browser: Browser) {
  await browser.evaluate<null>(`(${patchMatchMediaForReducedMotion.toString()})`);
}
