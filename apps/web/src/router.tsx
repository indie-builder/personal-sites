import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    // 关闭框架托管的滚动恢复：初始水合会多出一次 scrollTo(top:0)，且与页面自有的
    // 流式快照恢复（use-stream-feed）叠加。历史遍历的滚动还原交给浏览器原生行为。
    scrollRestoration: false,
    // 对齐原 Next Router Cache 的 staleTimes.dynamic=30：会话内往返（详情返回列表）
    // 直接复用 30 秒内的 loader 数据，避免返回时同步重挂起把整棵旧树隐藏
    //（React 对同步挂起会 display:none!important 隐藏当前树）。
    defaultStaleTime: 30_000,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
