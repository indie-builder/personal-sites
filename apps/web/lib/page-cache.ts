/**
 * 页面外壳的 ISR 等价缓存头：s-maxage 档位对应原 `export const revalidate`，
 * stale-while-revalidate 提供过期后的后台再生窗口（由 CDN 兑现）。
 */
export function pageCacheControl(seconds: number) {
  return `public, s-maxage=${seconds}, stale-while-revalidate=86400`;
}
