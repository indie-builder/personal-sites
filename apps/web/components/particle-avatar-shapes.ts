const TAU = Math.PI * 2;

// 栅格化画布边长，与概念板一致；形态坐标按此边长归一。
export const SHAPE_SRC = 240;

export const FUN_SHAPE_IDS = ["terminal", "robot", "infinity", "planet", "plane", "spark", "sprout", "smile", "fish"] as const;

export type FunShapeId = (typeof FUN_SHAPE_IDS)[number];

export type FunTrack = readonly FunShapeId[];

// 五支彩蛋轨道覆盖全部九形；鱼轨单独成轨。
export const FUN_TRACKS = [
  ["terminal", "robot"],
  ["infinity", "planet"],
  ["plane", "spark"],
  ["sprout", "smile"],
  ["fish"],
] as const satisfies readonly FunTrack[];

// 有明确「一次拍」手势的形态；其余落形后静态停留即可。
export const GESTURE_SHAPES: ReadonlySet<FunShapeId> = new Set(["robot", "planet", "plane", "sprout", "smile", "fish"]);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ShapeCtx = Pick<CanvasRenderingContext2D,
  | "beginPath" | "moveTo" | "lineTo" | "bezierCurveTo" | "quadraticCurveTo" | "closePath"
  | "arc" | "ellipse" | "roundRect" | "fill" | "stroke" | "save" | "restore"
  | "translate" | "rotate" | "scale" | "fillStyle" | "strokeStyle" | "lineWidth" | "lineCap" | "lineJoin"
>;

function inkStroke(ctx: ShapeCtx, width: number) {
  ctx.strokeStyle = "#000";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

// pose=0 静态定式；pose=1 是眨眼/摆尾等替代姿势（无手势的形态忽略 pose）。
type ShapeDraw = (ctx: ShapeCtx, pose: 0 | 1) => void;

function drawTerminal(ctx: ShapeCtx) {
  ctx.beginPath();
  ctx.roundRect(33, 45, 174, 150, 18);
  inkStroke(ctx, 10);
  ctx.beginPath();
  ctx.moveTo(34, 82);
  ctx.lineTo(205, 82);
  inkStroke(ctx, 7);
  ctx.fillStyle = "#000";
  for (const x of [50, 65, 80]) {
    ctx.beginPath();
    ctx.arc(x, 63, 3, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(63, 112);
  ctx.lineTo(84, 133);
  ctx.lineTo(63, 154);
  ctx.moveTo(104, 157);
  ctx.lineTo(148, 157);
  inkStroke(ctx, 11);
}

function drawRobot(ctx: ShapeCtx, pose: 0 | 1) {
  ctx.beginPath();
  ctx.roundRect(48, 72, 144, 116, 25);
  inkStroke(ctx, 12);
  ctx.beginPath();
  ctx.moveTo(120, 72);
  ctx.lineTo(120, 49);
  ctx.moveTo(35, 111);
  ctx.lineTo(35, 145);
  ctx.moveTo(205, 111);
  ctx.lineTo(205, 145);
  inkStroke(ctx, 10);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(120, 39, 9, 0, TAU);
  ctx.fill();
  if (pose === 0) {
    for (const x of [86, 154]) {
      ctx.beginPath();
      ctx.arc(x, 119, 11, 0, TAU);
      ctx.fill();
    }
  } else {
    // 眨眼：双眼收成短横线。
    ctx.beginPath();
    ctx.moveTo(75, 119);
    ctx.lineTo(97, 119);
    ctx.moveTo(143, 119);
    ctx.lineTo(165, 119);
    inkStroke(ctx, 9);
  }
  ctx.beginPath();
  ctx.moveTo(96, 158);
  ctx.lineTo(144, 158);
  inkStroke(ctx, 8);
}

function drawInfinity(ctx: ShapeCtx) {
  ctx.beginPath();
  ctx.moveTo(120, 120);
  ctx.bezierCurveTo(88, 75, 37, 66, 37, 120);
  ctx.bezierCurveTo(37, 174, 88, 165, 120, 120);
  ctx.bezierCurveTo(152, 75, 203, 66, 203, 120);
  ctx.bezierCurveTo(203, 174, 152, 165, 120, 120);
  inkStroke(ctx, 18);
}

function drawPlanet(ctx: ShapeCtx, pose: 0 | 1) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(120, 120, 57, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(120, 120);
  // 手势是轨道倾角的一次轻摆；白笔画靠亮度过滤不算墨点，只负责擦出环缝。
  ctx.rotate(pose === 0 ? -0.4 : -0.95);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(0, 0, 97, 31, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(0, 0, 98, 32, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawPlane(ctx: ShapeCtx, pose: 0 | 1) {
  if (pose === 1) {
    // 手势是朝右上的轻轻一跃。
    ctx.save();
    ctx.translate(0, -14);
    ctx.rotate(-0.06);
  }
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(33, 105);
  ctx.lineTo(206, 40);
  ctx.lineTo(146, 206);
  ctx.lineTo(109, 143);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(109, 143);
  ctx.lineTo(191, 54);
  ctx.moveTo(109, 143);
  ctx.lineTo(146, 206);
  ctx.stroke();
  if (pose === 1) ctx.restore();
}

function drawSpark(ctx: ShapeCtx) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(120, 24);
  ctx.bezierCurveTo(132, 93, 148, 108, 216, 120);
  ctx.bezierCurveTo(148, 132, 132, 148, 120, 216);
  ctx.bezierCurveTo(108, 148, 92, 132, 24, 120);
  ctx.bezierCurveTo(92, 108, 108, 92, 120, 24);
  ctx.fill();
}

function drawSprout(ctx: ShapeCtx, pose: 0 | 1) {
  ctx.beginPath();
  ctx.moveTo(118, 202);
  ctx.bezierCurveTo(120, 160, 127, 139, 140, 111);
  inkStroke(ctx, 10);
  ctx.fillStyle = "#000";
  // 手势是两片叶各绕茎的着生点再舒展一圈，读作「又长了一截」。
  const leaf = (ax: number, ay: number, draw: () => void) => {
    if (pose === 0) {
      draw();
      return;
    }
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(1.16, 1.16);
    ctx.translate(-ax, -ay);
    draw();
    ctx.restore();
  };
  leaf(127, 144, () => {
    ctx.beginPath();
    ctx.moveTo(127, 144);
    ctx.bezierCurveTo(71, 151, 40, 117, 48, 76);
    ctx.bezierCurveTo(102, 75, 129, 104, 127, 144);
    ctx.fill();
  });
  leaf(135, 119, () => {
    ctx.beginPath();
    ctx.moveTo(135, 119);
    ctx.bezierCurveTo(135, 69, 166, 47, 204, 50);
    ctx.bezierCurveTo(207, 94, 184, 125, 135, 119);
    ctx.fill();
  });
}

function drawSmile(ctx: ShapeCtx, pose: 0 | 1) {
  ctx.beginPath();
  ctx.arc(120, 120, 82, 0, TAU);
  inkStroke(ctx, 10);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(88, 101, 8, 12, 0, 0, TAU);
  ctx.fill();
  if (pose === 0) {
    ctx.beginPath();
    ctx.ellipse(151, 101, 8, 12, 0, 0, TAU);
    ctx.fill();
  } else {
    // 眨单眼：右眼收成短横线。
    ctx.beginPath();
    ctx.moveTo(141, 101);
    ctx.lineTo(161, 101);
    inkStroke(ctx, 8);
  }
  ctx.beginPath();
  ctx.arc(120, 120, 44, 0.18 * Math.PI, 0.82 * Math.PI);
  inkStroke(ctx, 10);
}

function drawFish(ctx: ShapeCtx, pose: 0 | 1) {
  // 手势是尾柄的一次收拢摆动。
  const tailX = pose === 0 ? 25 : 46;
  const tailTop = pose === 0 ? 82 : 90;
  const tailBottom = pose === 0 ? 158 : 150;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(52, 119);
  ctx.bezierCurveTo(97, 54, 169, 54, 206, 120);
  ctx.bezierCurveTo(166, 186, 94, 186, 52, 121);
  ctx.lineTo(tailX, tailBottom);
  ctx.lineTo(tailX, tailTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(167, 107, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(115, 120);
  ctx.quadraticCurveTo(121, 135, 134, 141);
  ctx.stroke();
}

export const SHAPE_DRAW: Record<FunShapeId, ShapeDraw> = {
  terminal: drawTerminal,
  robot: drawRobot,
  infinity: drawInfinity,
  planet: drawPlanet,
  plane: drawPlane,
  spark: drawSpark,
  sprout: drawSprout,
  smile: drawSmile,
  fish: drawFish,
};

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

export function shapeRng(id: FunShapeId) {
  let seed = 0x5eed;
  for (const ch of id) seed = (Math.imul(seed, 31) + (ch.codePointAt(0) ?? 0)) | 0;
  return mulberry32(seed);
}

export type ShapeTargets = Partial<Record<FunShapeId, readonly [Float32Array, Float32Array]>>;

export function buildShapeTargets(count: number): ShapeTargets {
  const out: ShapeTargets = {};
  if (count <= 0) return out;
  const off = document.createElement("canvas");
  off.width = SHAPE_SRC;
  off.height = SHAPE_SRC;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;
  for (const id of FUN_SHAPE_IDS) {
    try {
      const poses: (Float32Array | null)[] = [];
      for (const pose of [0, 1] as const) {
        ctx.clearRect(0, 0, SHAPE_SRC, SHAPE_SRC);
        SHAPE_DRAW[id](ctx, pose);
        poses.push(sampleInkPoints(ctx.getImageData(0, 0, SHAPE_SRC, SHAPE_SRC).data, SHAPE_SRC, count, shapeRng(id)));
      }
      if (poses[0] && poses[1]) out[id] = [poses[0], poses[1]];
    } catch {
      // 旧引擎缺 roundRect/ellipse 等接口时只损失该形态。
    }
  }
  return out;
}

export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 混合输入或中断后，袋内下一项也可能与实际展示形态相同；只剩该项时提前重洗。
export function nextTrack(bag: readonly FunTrack[] | null, lastForm: FunShapeId | null, rand: () => number): { track: FunTrack; bag: FunTrack[] } {
  const pool: FunTrack[] = bag?.length ? [...bag] : shuffled<FunTrack>(FUN_TRACKS, rand);
  if (pool[0][0] === lastForm) {
    const alternative = pool.findIndex((track) => track[0] !== lastForm);
    if (alternative < 0) return nextTrack(null, lastForm, rand);
    [pool[0], pool[alternative]] = [pool[alternative], pool[0]];
  }
  const [track, ...rest] = pool;
  return { track, bag: rest };
}

export function nextStaticForm(bag: readonly FunShapeId[] | null, lastForm: FunShapeId | null, rand: () => number): { form: FunShapeId; bag: FunShapeId[] } {
  const pool: FunShapeId[] = bag?.length ? [...bag] : shuffled<FunShapeId>(FUN_SHAPE_IDS, rand);
  if (pool[0] === lastForm) {
    const alternative = pool.findIndex((form) => form !== lastForm);
    if (alternative < 0) return nextStaticForm(null, lastForm, rand);
    [pool[0], pool[alternative]] = [pool[alternative], pool[0]];
  }
  const [form, ...rest] = pool;
  return { form, bag: rest };
}

export const FORM_MORPH_MS = 520;
export const FORM_STAGGER = 60;
export const FORM_STATIC_DWELL_MS = 300;
export const ARRIVE_DWELL_MS = 140;
export const POSE_MORPH_MS = 180;
export const POSE_DWELL_MS = 110;
export const POSE_BACK_DWELL_MS = 140;
export const RETURN_MORPH_MS = 600;
export const RETURN_STAGGER = 100;

export type ShapeStageSpec = {
  shape: FunShapeId;
  pose: 0 | 1;
  morphMs: number;
  stagger: number;
  dwellMs: number;
};

// 一支轨道的形态节拍：落形 →（手势形）一次有限拍姿并回正 → 交回返回段。
// 各站之和含返回段控制在 4s 内；不产生任何持续循环。
export function planSurpriseStages(track: FunTrack): ShapeStageSpec[] {
  const stages: ShapeStageSpec[] = [];
  for (const shape of track) {
    if (!GESTURE_SHAPES.has(shape)) {
      stages.push({ shape, pose: 0, morphMs: FORM_MORPH_MS, stagger: FORM_STAGGER, dwellMs: FORM_STATIC_DWELL_MS });
      continue;
    }
    stages.push({ shape, pose: 0, morphMs: FORM_MORPH_MS, stagger: FORM_STAGGER, dwellMs: ARRIVE_DWELL_MS });
    stages.push({ shape, pose: 1, morphMs: POSE_MORPH_MS, stagger: 0, dwellMs: POSE_DWELL_MS });
    stages.push({ shape, pose: 0, morphMs: POSE_MORPH_MS, stagger: 0, dwellMs: POSE_BACK_DWELL_MS });
  }
  return stages;
}
