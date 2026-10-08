// 首访仪式的会话标记与「档案摊开」入场的事件通道。
// OpeningLoader 在揭幕（上滑）开始时广播事件；内容流的 SectionMotionLifecycle
// 只在仪式本会话未播放过时武装入场阶梯，两条路径共用同一份 sessionStorage 成本模型。

const OPENING_PLAYED_KEY = "personal-site:opening-loader-played";

const OPENING_REVEAL_EVENT = "site:opening-reveal";

// 揭幕事件是否已在本文档派发及其时刻（performance.now 系）：订阅晚于
// 派发的消费者（如头像粒子序列的字形采样恰逢离场帘抬起的竞态）据此
// 即时回放，而不是永远错过 once 监听。
let openingRevealAt: number | null = null;

export function hasOpeningPlayedThisSession() {
  try {
    return window.sessionStorage.getItem(OPENING_PLAYED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOpeningPlayed() {
  try {
    window.sessionStorage.setItem(OPENING_PLAYED_KEY, "true");
  } catch {
    // Storage can be disabled; the current visit still reaches its stable final state.
  }
}

export function dispatchOpeningReveal() {
  openingRevealAt = performance.now();
  window.dispatchEvent(new CustomEvent(OPENING_REVEAL_EVENT));
}

export function onOpeningReveal(handler: () => void) {
  window.addEventListener(OPENING_REVEAL_EVENT, handler, { once: true });
  return () => window.removeEventListener(OPENING_REVEAL_EVENT, handler);
}

// null 表示本文档尚未揭幕；订阅方应先订阅事件再读此值。
export function getOpeningRevealAt() {
  return openingRevealAt;
}
