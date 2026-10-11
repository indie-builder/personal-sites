// 两处共用原精灵的 27×32 坐标，避免 SVG 与粒子轮廓分叉。
export type SpriteRect = readonly [x: number, y: number, width: number, height: number];

export const SPRITE_BODY_RECTS = [
  [0, 0, 8, 24],
  [12, 0, 8, 8],
  [7, 4, 16, 4],
  [12, 4, 4, 12],
  [20, 4, 4, 12],
  [7, 12, 20, 4],
  [4, 15, 19, 13],
  [8, 15, 4, 13],
  [16, 20, 4, 8],
] as const satisfies readonly SpriteRect[];

// 原精灵自带的两个脚步帧：feetA 静止帧，feetB 迈步帧。
export const SPRITE_FEET_A_RECTS = [
  [8, 28, 4, 4],
  [16, 28, 4, 4],
] as const satisfies readonly SpriteRect[];

export const SPRITE_FEET_B_RECTS = [
  [10, 28, 4, 4],
  [14, 28, 4, 4],
] as const satisfies readonly SpriteRect[];
