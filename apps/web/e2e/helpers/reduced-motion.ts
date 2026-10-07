import type { Browser } from "@e2e-dev/web";

// e2e 框架没有 emulateMedia({ reducedMotion })（文档列为 missing），web 引擎也不模拟
// prefers-reduced-motion。改写 matchMedia 只让此后的调用读到 reduce：不改变 CSS
// @media (prefers-reduced-motion) 规则，也不更新已创建的 MediaQueryList 或派发
// change 事件。匹配两类查询串：显式 ": reduce"（站内组件的直读）与裸特性形式
// "(prefers-reduced-motion)"（motion 库模块初始化的现读）——init script 版在页面脚本
// 前安装即可让 motion 的 useReducedMotion 初始化读到 reduce；已初始化的订阅
// （change 事件）仍不受补丁影响，依赖它们的现读场景需另行处理。
function patchMatchMediaForReducedMotion() {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const mql = nativeMatchMedia(query);
    const asksReducedMotion = /prefers-reduced-motion/.test(query)
      && !/prefers-reduced-motion:\s*no-preference/.test(query);
    if (!mql.matches && asksReducedMotion) {
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
