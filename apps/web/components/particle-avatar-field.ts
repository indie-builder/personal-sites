import { mulberry32 } from "@/components/particle-avatar-shapes";

const STIPPLE_SRC = "/images/ample-avatar-stipple.png";
const TARGET_COUNT = 700;
const MAX_COUNT = 4000;
const ASSEMBLE_STAGGER = 240;
const TAU = Math.PI * 2;
// 等面积圆在高频下会被抗锯齿稀释成浅灰；放大半径补回点描图实心墨点
// （中位等价半径约 1.13 源像素）的视觉重量。
const DOT_GAIN = 1.45;

// 名字序列：揭幕帘升起并完全让开头像后，同一批粒子按名字逐字成形，
// 最终落回头像。每段形变约 0.7s、每字停留约 0.4s，整段 3s 出头。
const GLYPH_SRC = 200;
const GLYPH_FONT = '-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const GLYPH_FONT_WEIGHT = 600;
const GLYPH_INSET = 0.1;
const INTRO_CHAR_MORPH_MS = 700;
const INTRO_CHAR_DWELL_MS = 380;
const INTRO_CHAR_STAGGER = 120;
const INTRO_AVATAR_MORPH_MS = 800;

export type ParticleField = {
  targets: Float32Array;
  scatter: Float32Array;
  delays: Float32Array;
  radii: Float32Array;
  sourceSize: number;
};

// 有限序列（开场姓名）与持续循环（像素伙伴）中的一站：粒子飞往 targets
// 停 dwellMs。
export type SequenceStage = {
  shape: "portrait" | "name" | "mascot";
  targets: Float32Array;
  morphMs: number;
  stagger: number;
  dwellMs: number;
};

// 按网格单元聚合墨点像素质心作为成像目标，半径取单元内墨水面积的
// 等面积圆半径，细步长保证颗粒接近原图点描纹理而不是合并成大圆。
export async function sampleParticleField(): Promise<ParticleField | null> {
  // next/image 的 Image 遮蔽全局 Image，必须 createElement 建原生 img。
  const img = document.createElement("img");
  img.src = STIPPLE_SRC;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  if (!offCtx || w === 0 || h === 0) return null;
  offCtx.drawImage(img, 0, 0);
  let pixels: Uint8ClampedArray;
  try {
    pixels = offCtx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const a = pixels[i * 4 + 3];
      if (a < 128) continue;
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b < 128) {
        dark[i] = 1;
      }
    }
  }
  const inkCount = dark.reduce((sum, v) => sum + v, 0);
  if (inkCount === 0) return null;

  let chosen: { xs: number[]; ys: number[]; fills: number[]; step: number } | null = null;
  for (let step = 2; step <= 8; step += 1) {
    const xs: number[] = [];
    const ys: number[] = [];
    const fills: number[] = [];
    for (let cy = 0; cy < h; cy += step) {
      for (let cx = 0; cx < w; cx += step) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (let y = cy; y < Math.min(cy + step, h); y += 1) {
          for (let x = cx; x < Math.min(cx + step, w); x += 1) {
            if (dark[y * w + x]) {
              sumX += x;
              sumY += y;
              count += 1;
            }
          }
        }
        if (count > 0) {
          xs.push(sumX / count / w);
          ys.push(sumY / count / h);
          fills.push(count / (step * step));
        }
      }
    }
    chosen = { xs, ys, fills, step };
    if (xs.length <= MAX_COUNT) break;
  }
  if (!chosen) return null;
  let picked = chosen;
  if (picked.xs.length > MAX_COUNT) {
    // 步长到 8 仍超限时按固定种子抽稀，保持分布。
    const rand = mulberry32(0x5eed);
    const keep = new Set<number>();
    while (keep.size < TARGET_COUNT) keep.add(Math.floor(rand() * picked.xs.length));
    const idx = [...keep];
    const thin = { xs: idx.map((i) => picked.xs[i]), ys: idx.map((i) => picked.ys[i]), fills: idx.map((i) => picked.fills[i]), step: picked.step };
    picked = thin;
  }
  const n = picked.xs.length;
  const targets = new Float32Array(n * 2);
  const scatter = new Float32Array(n * 2);
  const delays = new Float32Array(n);
  const radii = new Float32Array(n);
  const rand = mulberry32(0x5eed);
  for (let i = 0; i < n; i += 1) {
    targets[i * 2] = picked.xs[i];
    targets[i * 2 + 1] = picked.ys[i];
    radii[i] = (picked.step * Math.sqrt(picked.fills[i]) * DOT_GAIN) / 2;
    // 散开位固定落在方框四周边环，seeded 保证每次一致。
    const angle = rand() * TAU;
    const radius = 0.3 + rand() * 0.18;
    scatter[i * 2] = 0.5 + Math.cos(angle) * radius;
    scatter[i * 2 + 1] = 0.5 + Math.sin(angle) * radius;
    delays[i] = rand();
  }
  return {
    targets,
    scatter,
    delays,
    radii,
    sourceSize: w,
  };
}

// 离屏绘制单个汉字并等量采样墨点作成形目标：字形按包围盒等比居中放进
// [GLYPH_INSET, 1-GLYPH_INSET] 方框，与头像共用同一画布坐标系；
// 点数严格等于粒子数，序列各段画面完整不闪变。
async function sampleGlyphField(char: string, count: number): Promise<Float32Array | null> {
  const fontSize = Math.round(GLYPH_SRC * 0.78);
  // 先让系统中文字体对该字就绪再绘制，避免采样到豆腐块或缺字。
  try {
    await document.fonts.load(`${GLYPH_FONT_WEIGHT} ${fontSize}px ${GLYPH_FONT}`, char);
  } catch {
    // 字体加载探测失败仍尝试绘制，由下方墨点数量兜底判定。
  }
  const off = document.createElement("canvas");
  off.width = GLYPH_SRC;
  off.height = GLYPH_SRC;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${GLYPH_FONT_WEIGHT} ${fontSize}px ${GLYPH_FONT}`;
  ctx.fillText(char, GLYPH_SRC / 2, GLYPH_SRC / 2);
  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, GLYPH_SRC, GLYPH_SRC).data;
  } catch {
    return null;
  }
  const xs: number[] = [];
  const ys: number[] = [];
  let minX = GLYPH_SRC;
  let minY = GLYPH_SRC;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < GLYPH_SRC; y += 1) {
    for (let x = 0; x < GLYPH_SRC; x += 1) {
      if (pixels[(y * GLYPH_SRC + x) * 4 + 3] >= 128) {
        xs.push(x);
        ys.push(y);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  // 墨点不足按字形失败处理：序列跳过该字而不是画一摊噪点。
  if (xs.length < count * 2) return null;
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const span = 1 - GLYPH_INSET * 2;
  const scale = Math.min(span / bw, span / bh);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const points = new Float32Array(count * 2);
  // 部分洗牌等价于无放回抽取，墨点分布均匀且按字固定种子可复现。
  const rand = mulberry32(0x5eed ^ (char.codePointAt(0) ?? 0) * 0x9e3779b1);
  const n = xs.length;
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rand() * (n - i));
    const tx = xs[j];
    xs[j] = xs[i];
    xs[i] = tx;
    const ty = ys[j];
    ys[j] = ys[i];
    ys[i] = ty;
    points[i * 2] = 0.5 + (xs[i] - cx) * scale;
    points[i * 2 + 1] = 0.5 + (ys[i] - cy) * scale;
  }
  return points;
}

export async function buildIntroStages(name: string, field: ParticleField): Promise<SequenceStage[]> {
  const count = field.targets.length / 2;
  const stages: SequenceStage[] = [];
  for (const char of [...name]) {
    if (!char.trim()) continue;
    const targets = await sampleGlyphField(char, count);
    if (targets) {
      stages.push({ shape: "name", targets, morphMs: INTRO_CHAR_MORPH_MS, stagger: INTRO_CHAR_STAGGER, dwellMs: INTRO_CHAR_DWELL_MS });
    }
  }
  stages.push({ shape: "portrait", targets: field.targets, morphMs: INTRO_AVATAR_MORPH_MS, stagger: ASSEMBLE_STAGGER, dwellMs: 0 });
  return stages;
}

export function paintParticleField(canvas: HTMLCanvasElement, field: ParticleField, pos: Float32Array): boolean {
  const css = canvas.clientWidth;
  if (css === 0) return false;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(css * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== width) canvas.height = width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 画布保持透明，页面底色即纸底；墨色取继承的 color，头像与冒险画面
  // 共用同一主题墨色，跟随浅深主题即时切换。
  ctx.clearRect(0, 0, css, css);
  ctx.beginPath();
  for (let i = 0; i < pos.length; i += 2) {
    const x = pos[i] * css;
    const y = pos[i + 1] * css;
    // 0.3px 半径下限避免亚像素圆完全不可见。
    const r = Math.max(0.3, (field.radii[i / 2] * css) / field.sourceSize);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fillStyle = getComputedStyle(canvas).color;
  ctx.fill();
  return true;
}
