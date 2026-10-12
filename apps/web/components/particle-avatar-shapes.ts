export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 落形/返回节拍：冒险的入场复用头像序列的落形语汇，返回沿用原节奏。
export const ARRIVAL_MORPH_MS = 520;
export const ARRIVAL_STAGGER = 60;
export const RETURN_MORPH_MS = 600;
export const RETURN_STAGGER = 100;
