import { SPRITE_BODY_RECTS, SPRITE_FEET_A_RECTS, SPRITE_FEET_B_RECTS } from "./assistant-sprite-geometry";

// 栅格化画布边长，与概念板一致；形态坐标按此边长归一。
export const SHAPE_SRC = 240;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SHAPE_POINT_MIN = 0.08;
export const SHAPE_POINT_MAX = 0.92;
// 夹紧值需再内收一档：0.08/0.92 本身无法被 Float32 精确表示，直接夹边
// 会回落到边界之外。
const CLAMP_MIN = 0.081;
const CLAMP_MAX = 0.919;

export function sampleInkPoints(rgba: ArrayLike<number>, side: number, count: number, rand: () => number): Float32Array | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const i = (y * side + x) * 4;
      if (rgba[i + 3] > 100 && 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2] < 140) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length === 0) return null;
  const points = new Float32Array(count * 2);
  const clamp = (v: number) => (v < CLAMP_MIN ? CLAMP_MIN : v > CLAMP_MAX ? CLAMP_MAX : v);
  for (let i = 0; i < count; i += 1) {
    const j = Math.min(xs.length - 1, Math.floor((i * xs.length) / count));
    points[i * 2] = clamp(xs[j] / side + (rand() - 0.5) * 0.008);
    points[i * 2 + 1] = clamp(ys[j] / side + (rand() - 0.5) * 0.008);
  }
  return points;
}

export type MascotCtx = Pick<CanvasRenderingContext2D, "fillRect" | "fillStyle" | "save" | "restore" | "translate" | "scale">;

// 整数倍缩放保留方块边缘，同时为粒子抖动留出内边距；pose 0/1 是原精灵
// 自带的 feetA 静止帧与 feetB 迈步帧。
export function drawMascot(ctx: MascotCtx, pose: 0 | 1) {
  ctx.fillStyle = "#000";
  ctx.save();
  ctx.translate(39, 24);
  ctx.scale(6, 6);
  for (const [x, y, width, height] of SPRITE_BODY_RECTS) ctx.fillRect(x, y, width, height);
  const feet = pose === 0 ? SPRITE_FEET_A_RECTS : SPRITE_FEET_B_RECTS;
  for (const [x, y, width, height] of feet) ctx.fillRect(x, y, width, height);
  ctx.restore();
}

export type MascotTargets = readonly [Float32Array, Float32Array];

// 与旧形态采样同源的固定种子，保证伙伴两个姿势的目标点逐次一致。
const MASCOT_SEED = [..."mascot"].reduce((seed, ch) => (Math.imul(seed, 31) + (ch.codePointAt(0) ?? 0)) | 0, 0x5eed);

export function buildMascotTargets(count: number): MascotTargets | null {
  if (count <= 0) return null;
  const off = document.createElement("canvas");
  off.width = SHAPE_SRC;
  off.height = SHAPE_SRC;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const poses: Float32Array[] = [];
  for (const pose of [0, 1] as const) {
    try {
      ctx.clearRect(0, 0, SHAPE_SRC, SHAPE_SRC);
      drawMascot(ctx, pose);
      const points = sampleInkPoints(ctx.getImageData(0, 0, SHAPE_SRC, SHAPE_SRC).data, SHAPE_SRC, count, mulberry32(MASCOT_SEED));
      if (!points) return null;
      poses.push(points);
    } catch {
      // 画布读取被环境拦截时只是伙伴不可用，头像本体不受影响。
      return null;
    }
  }
  return [poses[0], poses[1]];
}

// 伙伴节拍：落形（feetA）→ 迈步（feetB）→ 回正（feetA），末段停留结束后
// 循环回迈步段，只有 B↔A 原地踏步，永不出伙伴。
export const ARRIVAL_MORPH_MS = 520;
export const ARRIVAL_STAGGER = 60;
export const ARRIVAL_DWELL_MS = 140;
export const STEP_MORPH_MS = 180;
export const STEP_DWELL_MS = 110;
export const STEP_BACK_DWELL_MS = 140;
export const RETURN_MORPH_MS = 600;
export const RETURN_STAGGER = 100;
