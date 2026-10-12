import { SPRITE_BODY_RECTS, SPRITE_FEET_A_RECTS, SPRITE_FEET_B_RECTS, type SpriteRect } from "./assistant-sprite-geometry";

// 十段横版冒险（/tmp/avatar-adventure.js 原型的纯函数移植）：每段 10s、
// 一轮 100s 无限循环，章序随 index 取模回绕、轮数递增。无 DOM、无逐帧
// 大分配：自然点写入模块级复用缓冲，输出按粒子数取模填满。
export const ADVENTURE_CHAPTERS = ["hurdle", "gap", "stairs", "bump", "pushbox", "lift", "movingplatform", "crouch", "spring", "gate"] as const;
export type AdventureChapter = (typeof ADVENTURE_CHAPTERS)[number];
const CHAPTER_COUNT = ADVENTURE_CHAPTERS.length;

const ADVENTURE_CHAPTER_SECONDS = 10;
export const ADVENTURE_LOOP_SECONDS = ADVENTURE_CHAPTER_SECONDS * CHAPTER_COUNT;
// 减少/键盘定格取第一段 5s：助跑已过、跨栏动作正中的可读帧。
export const ADVENTURE_STATIC_TIME = 5;

// 逻辑视口（原型坐标系）：伙伴锚定视口 x=94，每章世界宽 420，相机随 x 平移。
const VIEW = 240;
const SPAN = 420;
const MASCOT_CX = 94;
const FLOOR_Y = 195;
const FLOOR_DOT_STEP = 10;
const MASCOT_SCALE = 2.6;

// 自然点上限：伙伴网格 ≤621 点，三章同屏最密布景约 1600 点，留余量取 2048。
export const ADVENTURE_NATURAL_CAPACITY = 2048;
const natural = new Float32Array(ADVENTURE_NATURAL_CAPACITY * 2);
let naturalCount = 0;

function pushPoint(x: number, y: number) {
  if (naturalCount >= ADVENTURE_NATURAL_CAPACITY) return;
  natural[naturalCount * 2] = x;
  natural[naturalCount * 2 + 1] = y;
  naturalCount += 1;
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * ease(t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
const arc = (u: number, h: number) => 4 * h * clamp(u) * (1 - clamp(u));

function chapterAt(index: number): AdventureChapter {
  return ADVENTURE_CHAPTERS[((index % CHAPTER_COUNT) + CHAPTER_COUNT) % CHAPTER_COUNT];
}

type AdventureMascotState = {
  chapter: AdventureChapter;
  x: number;
  y: number;
  lean: number;
  crouch: number;
  pose: 0 | 1;
};

// 各段收尾横坐标：p≥7 后从这里走向 420 交棒下一章。
const END_X: Record<AdventureChapter, number> = {
  hurdle: 266,
  gap: 272,
  stairs: 290,
  bump: 266,
  pushbox: 278,
  lift: 282,
  movingplatform: 290,
  crouch: 284,
  spring: 296,
  gate: 290,
};

function stateAt(index: number, p: number): AdventureMascotState {
  const chapter = chapterAt(index);
  let x = lerp(0, 420, p / 10);
  let y = 192;
  let lean = 0.08;
  let crouch = 1;
  let walking = true;
  if (p < 2) {
    x = lerp(0, 88, p / 2);
  } else if (p < 3) {
    x = 88;
    walking = false;
    lean = -0.08 * Math.sin((p - 2) * Math.PI);
  } else if (p < 7) {
    const u = (p - 3) / 4;
    switch (chapter) {
      case "hurdle":
        if (u < 0.18) {
          x = lerp(88, 62, u / 0.18);
          lean = -0.12;
        } else if (u < 0.3) {
          x = lerp(62, 94, (u - 0.18) / 0.12);
        } else {
          x = lerp(94, 266, (u - 0.3) / 0.7);
          y -= arc((u - 0.3) / 0.7, 84);
          walking = false;
        }
        break;
      case "gap":
        x = lerp(88, 272, u);
        y -= arc(u, 78);
        walking = false;
        break;
      case "stairs":
        if (u < 0.25) {
          const q = u / 0.25;
          x = lerp(88, 146, q);
          y = 192 - 26 * q - arc(q, 36);
        } else if (u < 0.5) {
          const q = (u - 0.25) / 0.25;
          x = lerp(146, 185, q);
          y = 166 - 26 * q - arc(q, 30);
        } else if (u < 0.72) {
          const q = (u - 0.5) / 0.22;
          x = lerp(185, 222, q);
          y = 140 - 26 * q - arc(q, 26);
        } else {
          const q = (u - 0.72) / 0.28;
          x = lerp(222, 290, q);
          y = 114 + 78 * q - arc(q, 42);
        }
        walking = false;
        break;
      case "bump":
        if (u < 0.3) {
          x = lerp(88, 154, u / 0.3);
        } else if (u < 0.7) {
          x = 154;
          y -= arc((u - 0.3) / 0.4, 45);
          walking = false;
        } else {
          x = lerp(154, 266, (u - 0.7) / 0.3);
        }
        break;
      case "pushbox":
        if (u < 0.62) {
          x = lerp(88, 172, u / 0.62);
          lean = 0.22;
        } else {
          x = lerp(172, 278, (u - 0.62) / 0.38);
          y -= arc((u - 0.62) / 0.38, 48);
          walking = false;
        }
        break;
      case "lift":
        if (u < 0.2) {
          x = lerp(88, 140, u / 0.2);
          y -= arc(u / 0.2, 12);
        } else if (u < 0.65) {
          x = 140;
          y = 192 - mix(0, 64, (u - 0.2) / 0.45);
          walking = false;
          lean = 0;
        } else {
          x = lerp(140, 282, (u - 0.65) / 0.35);
          y = 128 + 64 * clamp((u - 0.65) / 0.35) - arc((u - 0.65) / 0.35, 38);
          walking = false;
        }
        break;
      case "movingplatform":
        if (u < 0.22) {
          const q = u / 0.22;
          x = lerp(88, 146, q);
          y = 192 - 12 * q - arc(q, 48);
          walking = false;
        } else if (u < 0.72) {
          x = lerp(146, 220, (u - 0.22) / 0.5);
          y = 180;
          walking = false;
          lean = 0;
        } else {
          const q = (u - 0.72) / 0.28;
          x = lerp(220, 290, q);
          y = 180 + 12 * q - arc(q, 45);
          walking = false;
        }
        break;
      case "crouch":
        x = lerp(88, 284, u);
        crouch = u < 0.15 ? mix(1, 0.45, u / 0.15) : u > 0.88 ? mix(0.45, 1, (u - 0.88) / 0.12) : 0.45;
        lean = 0;
        break;
      case "spring":
        if (u < 0.22) {
          x = lerp(88, 124, u / 0.22);
        } else if (u < 0.36) {
          x = 124;
          y = 192 + mix(0, 8, (u - 0.22) / 0.14);
          crouch = mix(1, 0.7, (u - 0.22) / 0.14);
          walking = false;
        } else {
          const q = (u - 0.36) / 0.64;
          x = lerp(124, 296, q);
          y = 192 - arc(q, 96);
          walking = false;
        }
        break;
      case "gate":
        if (u < 0.22) {
          x = lerp(88, 124, u / 0.22);
        } else if (u < 0.5) {
          x = 124;
          crouch = 1 - 0.1 * Math.sin(((u - 0.22) / 0.28) * Math.PI);
          walking = false;
        } else {
          x = lerp(124, 290, (u - 0.5) / 0.5);
        }
        break;
    }
  } else {
    x = lerp(END_X[chapter], 420, (p - 7) / 3);
  }
  return { chapter, x, y, lean, crouch, pose: walking ? ((Math.floor(p * 8) % 2) as 0 | 1) : 1 };
}

export function adventureState(time: number): AdventureMascotState {
  const index = Math.floor(time / ADVENTURE_CHAPTER_SECONDS);
  return stateAt(index, time - index * ADVENTURE_CHAPTER_SECONDS);
}

// 共用精灵的像素网格点阵：与 assistant 同源的 27×32 矩形按 1.2 步长栅格
// 化，pose 0/1 对应原精灵 feetA/feetB 两帧。
const POSE_RECTS: readonly (readonly SpriteRect[])[] = [
  [...SPRITE_BODY_RECTS, ...SPRITE_FEET_A_RECTS],
  [...SPRITE_BODY_RECTS, ...SPRITE_FEET_B_RECTS],
];

function pushMascot(state: AdventureMascotState) {
  const rects = POSE_RECTS[state.pose];
  const cos = Math.cos(state.lean);
  const sin = Math.sin(state.lean);
  for (let y = 0; y < 32; y += 1.2) {
    for (let x = 0; x < 27; x += 1.2) {
      let inside = false;
      for (const [rx, ry, rw, rh] of rects) {
        if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
          inside = true;
          break;
        }
      }
      if (!inside) continue;
      const xx = x - 13.5;
      const yy = (y - 32) * state.crouch;
      pushPoint(MASCOT_CX + (xx * cos - yy * sin) * MASCOT_SCALE, state.y + (xx * sin + yy * cos) * MASCOT_SCALE);
    }
  }
}

function pushScenery(index: number, p: number, camera: number) {
  const base = index * SPAN;
  const chapter = stateAt(index, p).chapter;
  const box = (x: number, y: number, w: number, h: number, solid = false) => {
    const left = base + x - camera;
    if (left > 242 || left + w < 0) return;
    for (let j = 0; j <= h; j += 3) {
      for (let i = 0; i <= w; i += 3) {
        if (!solid && i > 3 && i < w - 3 && j > 3 && j < h - 3) continue;
        pushPoint(left + i, y + j);
      }
    }
  };
  // 地面以点行表示；断桥/河面章节靠 floor 段之间的空档读出缺口。
  const floor = (a: number, b: number) => {
    const right = Math.min(236, base + b - camera);
    for (let fx = Math.max(4, base + a - camera); fx <= right; fx += FLOOR_DOT_STEP) pushPoint(fx, FLOOR_Y);
  };
  const u = clamp((p - 3) / 4);
  switch (chapter) {
    case "hurdle":
      floor(0, 420);
      box(144, 154, 34, 38, true);
      break;
    case "gap":
      floor(0, 125);
      floor(226, 420);
      box(119, 195, 6, 30);
      box(226, 195, 6, 30);
      break;
    case "stairs":
      floor(0, 420);
      box(128, 166, 38, 26);
      box(166, 140, 38, 52);
      box(204, 114, 38, 78);
      break;
    case "bump": {
      floor(0, 420);
      const q = clamp((u - 0.3) / 0.4);
      const bump = q > 0.45 && q < 0.8 ? Math.sin(((q - 0.45) / 0.35) * Math.PI) * 9 : 0;
      box(133, 32 - bump, 42, 30);
      if (u > 0.5 && u < 0.82) {
        const flight = clamp((u - 0.5) / 0.32);
        const catcherX = stateAt(index, p).x;
        box(lerp(148, catcherX + 8, flight), 14 + 110 * flight - arc(flight, 30), 12, 12);
      }
      break;
    }
    case "pushbox": {
      floor(0, 194);
      floor(238, 420);
      const bx = lerp(129, 194, u / 0.62);
      const by = u > 0.5 ? mix(148, 181, (u - 0.5) / 0.12) : 148;
      box(bx, by, 44, 44);
      break;
    }
    case "lift": {
      floor(0, 420);
      const yy = 192 - mix(0, 64, (u - 0.2) / 0.45);
      box(110, yy, 62, 7);
      box(105, 128, 3, 64);
      box(175, 128, 3, 64);
      break;
    }
    case "movingplatform": {
      floor(0, 112);
      floor(265, 420);
      const px = u < 0.22 ? 146 : lerp(146, 220, (u - 0.22) / 0.5);
      box(px - 29, 180, 58, 8);
      break;
    }
    case "crouch":
      floor(0, 420);
      box(133, 113, 106, 28, true);
      box(232, 141, 7, 10);
      break;
    case "spring":
      floor(0, 420);
      box(108, 185 + (u > 0.22 && u < 0.36 ? 7 : 0), 32, 7);
      box(185, 133, 30, 59, true);
      break;
    case "gate": {
      floor(0, 420);
      box(111, 188, 25, 5, true);
      const rise = mix(0, 125, (u - 0.22) / 0.28);
      box(200, 93 - rise, 16, 99, true);
      box(193, 82, 30, 7);
      break;
    }
  }
}

type AdventureScene = { chapter: AdventureChapter; round: number; points: number };

// time→帧：自然点复用模块缓冲、视口裁剪后按 count 取模填满 out（不足则
// 重复点位，视觉等价、点数恒定），坐标归一到 [0,1)。
export function writeAdventureFrame(time: number, count: number, out: Float32Array): AdventureScene {
  const index = Math.floor(time / ADVENTURE_CHAPTER_SECONDS);
  const p = time - index * ADVENTURE_CHAPTER_SECONDS;
  const state = stateAt(index, p);
  const camera = index * SPAN + state.x - MASCOT_CX;
  naturalCount = 0;
  pushMascot(state);
  // 相邻章同屏保证相机连续：前一章取收尾姿态、后一章取起始姿态。
  pushScenery(index - 1, ADVENTURE_CHAPTER_SECONDS, camera);
  pushScenery(index, p, camera);
  pushScenery(index + 1, 0, camera);
  let kept = 0;
  for (let i = 0; i < naturalCount; i += 1) {
    const x = natural[i * 2];
    const y = natural[i * 2 + 1];
    if (x <= 3 || x >= 237 || y <= 3 || y >= 236) continue;
    natural[kept * 2] = x;
    natural[kept * 2 + 1] = y;
    kept += 1;
  }
  const usable = Math.max(1, kept);
  for (let i = 0; i < count; i += 1) {
    const j = (i % usable) * 2;
    out[i * 2] = natural[j] / VIEW;
    out[i * 2 + 1] = natural[j + 1] / VIEW;
  }
  return { chapter: state.chapter, round: Math.floor(index / CHAPTER_COUNT) + 1, points: kept };
}
