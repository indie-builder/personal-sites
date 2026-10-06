/** 全站共用的缓动曲线：内容行上浮、揭示、过渡统一使用这一条收束曲线。 */
export const STREAM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const STREAM_EASE_CSS = `cubic-bezier(${STREAM_EASE.join(",")})`;
export const STREAM_REVEAL_Y = 0.45;
export const STREAM_REVEAL_DURATION = 0.3;

/** 筛选切换时从头揭示的行数：只揭示首屏可见的前几行，其余行直接呈现，避免长列表整体延迟。 */
export const FILTER_REVEAL_COUNT = 8;

/** 追加/揭示行共用的入场阶梯间隔（32ms 一级，最多 9 级封顶）。 */
export const staggerDelay = (index: number) => Math.min(index, 9) * 0.032;
