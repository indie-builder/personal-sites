"use client";

import Image from "next/image";
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  getOpeningRevealAt,
  hasOpeningPlayedThisSession,
  onOpeningReveal,
} from "@/components/opening-reveal";
import {
  buildShapeTargets,
  mulberry32,
  nextStaticForm,
  nextTrack,
  planSurpriseStages,
  RETURN_MORPH_MS,
  RETURN_STAGGER,
  type FunShapeId,
  type FunTrack,
  type ShapeTargets,
} from "@/components/particle-avatar-shapes";

const STIPPLE_SRC = "/images/ample-avatar-stipple.png";
const STIPPLE_FALLBACK_SRC = "/images/ample-avatar-stipple-ink.png";
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
const INTRO_AFTER_REVEAL_MS = 850;
const INTRO_CHAR_MORPH_MS = 700;
const INTRO_CHAR_DWELL_MS = 380;
const INTRO_CHAR_STAGGER = 120;
const INTRO_AVATAR_MORPH_MS = 800;

// DOM 契约：data-avatar-state 是当前交互相位；data-avatar-shape 是已落定
// 形态，形变途中为 transition。仅在段落边界更新，不逐帧驱动 React。
type AvatarPhase = "idle" | "intro" | "surprise" | "returning" | "static";
type SettledShape = "portrait" | "name" | FunShapeId;
type AvatarShape = SettledShape | "transition";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type ParticleField = {
  targets: Float32Array;
  scatter: Float32Array;
  delays: Float32Array;
  radii: Float32Array;
  sourceSize: number;
};

// 有限序列（开场姓名或点击彩蛋）中的一站：粒子飞往 targets 停 dwellMs。
type SequenceStage = {
  shape: SettledShape;
  targets: Float32Array;
  morphMs: number;
  stagger: number;
  dwellMs: number;
};

// 唯一的序列所有者：节拍器职责与旧 IntroPlan 相同，kind 区分开场与彩蛋。
type SequencePlan = {
  kind: "intro" | "surprise";
  stages: SequenceStage[];
  next: number;
  timer: number;
  dwellEndsAt: number;
  // 隐藏/离屏时停留计时同步冻结，恢复可见后续走剩余停留而不是整段吞掉。
  dwellRemaining: number | null;
  // 停留到点时被隐藏挂起的推进，恢复可见时即刻续拍。
  holdAdvance: boolean;
};

// 按网格单元聚合墨点像素质心作为成像目标，半径取单元内墨水面积的
// 等面积圆半径，细步长保证颗粒接近原图点描纹理而不是合并成大圆。
async function sampleParticleField(): Promise<ParticleField | null> {
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

async function buildIntroStages(name: string, count: number): Promise<SequenceStage[]> {
  const stages: SequenceStage[] = [];
  for (const char of [...name]) {
    if (!char.trim()) continue;
    const targets = await sampleGlyphField(char, count);
    if (targets) {
      stages.push({ shape: "name", targets, morphMs: INTRO_CHAR_MORPH_MS, stagger: INTRO_CHAR_STAGGER, dwellMs: INTRO_CHAR_DWELL_MS });
    }
  }
  return stages;
}

type ParticleAvatarProps = {
  name: string;
};

export function ParticleAvatar({ name }: ParticleAvatarProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ParticleField | null>(null);
  const posRef = useRef<Float32Array | null>(null);
  const endsRef = useRef<Float32Array | null>(null);
  const startsRef = useRef<Float32Array | null>(null);
  const animRef = useRef<{ t0: number; dur: number; stagger: number; raf: number; ease: (t: number) => number } | null>(null);
  const planRef = useRef<SequencePlan | null>(null);
  // 开场仪式整体生命周期的作废标记：等待揭幕的窗口期内点击/开启减少
  // 动态同样作废，迟到的 reveal 回调与字形采样不得再开演或直写头像。
  const introAbortedRef = useRef(false);
  // 'pending'：开场仪式尚未演完（含等待揭幕）；任何取消/播完即 'done'。
  const introStageRef = useRef<"pending" | "done">("pending");
  // step 的定格回调需要推进序列，经 ref 解开与 animateTo 的循环依赖。
  const advanceRef = useRef<() => void>(() => {});
  const pausedAtRef = useRef(0);
  const visibleRef = useRef(true);
  // 彩蛋形态目标（九形 × 两姿势）与两只洗牌袋的状态。
  const shapesRef = useRef<ShapeTargets>({});
  const trackBagRef = useRef<FunTrack[] | null>(null);
  const staticBagRef = useRef<readonly FunShapeId[] | null>(null);
  const lastShownFormRef = useRef<FunShapeId | null>(null);
  const staticShapeRef = useRef<FunShapeId | null>(null);
  // 粒子画布首次成功绘制后才接管，散开态不透出静态完整脸。
  const [particlesOn, setParticlesOn] = useState(false);
  const [view, setView] = useState<{ phase: AvatarPhase; shape: AvatarShape }>({ phase: "idle", shape: "portrait" });

  const paint = useCallback((): boolean => {
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    const pos = posRef.current;
    if (!canvas || !field || !pos) return false;
    const css = canvas.clientWidth;
    if (css === 0) return false;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(css * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== width) canvas.height = width;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 画布透明，墨色取继承的 color，跟随浅深主题即时切换。
    ctx.clearRect(0, 0, css, css);
    ctx.fillStyle = getComputedStyle(canvas).color;
    ctx.beginPath();
    for (let i = 0; i < pos.length; i += 2) {
      const x = pos[i] * css;
      const y = pos[i + 1] * css;
      // 0.3px 半径下限避免亚像素圆完全不可见。
      const r = Math.max(0.3, (field.radii[i / 2] * css) / field.sourceSize);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    return true;
  }, []);

  const stopLoop = useCallback(() => {
    const anim = animRef.current;
    if (anim?.raf) cancelAnimationFrame(anim.raf);
    if (anim) anim.raf = 0;
  }, []);

  const step = useCallback(
    function step(now: number) {
      const anim = animRef.current;
      const field = fieldRef.current;
      const pos = posRef.current;
      const starts = startsRef.current;
      const ends = endsRef.current;
      if (!anim || !field || !pos || !starts || !ends) return;
      let settled = true;
      for (let i = 0; i < pos.length; i += 2) {
        const delay = field.delays[i / 2] * anim.stagger;
        const local = (now - anim.t0 - delay) / anim.dur;
        const t = local >= 1 ? 1 : local <= 0 ? 0 : local;
        if (local < 1) settled = false;
        const e = anim.ease(t);
        pos[i] = starts[i] + (ends[i] - starts[i]) * e;
        pos[i + 1] = starts[i + 1] + (ends[i + 1] - starts[i + 1]) * e;
      }
      paint();
      if (settled) {
        animRef.current = null;
        // 当前段形变真实完成（仅在可见帧发生）：此刻才起停留计时，并按
        // 落定形态更新 DOM；末段落定即序列收尾回到 idle。
        const plan = planRef.current;
        const stage = plan?.stages[plan.next - 1];
        if (plan && stage) {
          const finished = plan.next >= plan.stages.length;
          if (stage.shape !== "portrait" && stage.shape !== "name") lastShownFormRef.current = stage.shape;
          setView((v) => ({ ...v, phase: finished ? "idle" : v.phase, shape: stage.shape }));
          if (finished) {
            planRef.current = null;
            if (plan.kind === "intro") introStageRef.current = "done";
          } else if (!plan.timer && stage.dwellMs > 0) {
            plan.dwellEndsAt = now + stage.dwellMs;
            plan.timer = window.setTimeout(advanceRef.current, stage.dwellMs);
          }
        }
        return;
      }
      anim.raf = requestAnimationFrame(step);
    },
    [paint],
  );

  const runLoop = useCallback(() => {
    const anim = animRef.current;
    if (!anim || anim.raf) return;
    if (!visibleRef.current || document.hidden) {
      pausedAtRef.current = performance.now();
      return;
    }
    anim.raf = requestAnimationFrame(step);
  }, [step]);

  const animateTo = useCallback(
    (ends: Float32Array, dur: number, stagger: number, ease: (t: number) => number) => {
      const pos = posRef.current;
      if (!pos) return;
      stopLoop();
      const starts = new Float32Array(pos);
      startsRef.current = starts;
      endsRef.current = ends;
      animRef.current = { t0: performance.now(), dur, stagger, raf: 0, ease };
      runLoop();
    },
    [runLoop, stopLoop],
  );

  const cancelSequence = useCallback(() => {
    const plan = planRef.current;
    if (plan) {
      if (plan.timer) window.clearTimeout(plan.timer);
      planRef.current = null;
    }
    stopLoop();
    animRef.current = null;
  }, [stopLoop]);

  // 序列的节拍器：每段形变由 animateTo 驱动，定格时 step 回调按该段
  // dwellMs 起停留计时再进下一段；到点时不可见则挂起，交恢复路径续拍。
  const advanceSequence = useCallback(() => {
    const plan = planRef.current;
    if (!plan) return;
    plan.timer = 0;
    plan.dwellEndsAt = 0;
    plan.dwellRemaining = null;
    // 后台标签/滚出视口：不推进也不轮询，回到可见时由 resumeAnim 续拍。
    if (document.hidden || !visibleRef.current) {
      plan.holdAdvance = true;
      return;
    }
    const stage = plan.stages[plan.next];
    if (!stage) return;
    plan.next += 1;
    const phase: AvatarPhase = stage.shape === "portrait" ? "returning" : plan.kind === "intro" ? "intro" : "surprise";
    setView((v) => ({ ...v, phase, shape: "transition" }));
    animateTo(stage.targets, stage.morphMs, stage.stagger, easeInOutCubic);
  }, [animateTo]);

  useEffect(() => {
    advanceRef.current = advanceSequence;
  }, [advanceSequence]);

  const startReturn = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    planRef.current = {
      kind: "surprise",
      stages: [{ shape: "portrait", targets: field.targets, morphMs: RETURN_MORPH_MS, stagger: RETURN_STAGGER, dwellMs: 0 }],
      next: 0,
      timer: 0,
      dwellEndsAt: 0,
      dwellRemaining: null,
      holdAdvance: false,
    };
    setView((v) => ({ ...v, phase: "returning", shape: "transition" }));
    advanceRef.current();
  }, []);

  // 空闲时的一次点击彩蛋：抽一支轨道，形态目标缺位的站自动跳过。
  const startSurprise = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const shapes = shapesRef.current;
    const draw = nextTrack(trackBagRef.current, lastShownFormRef.current, Math.random);
    trackBagRef.current = draw.bag;
    const stages: SequenceStage[] = [];
    for (const spec of planSurpriseStages(draw.track)) {
      const targets = shapes[spec.shape]?.[spec.pose];
      if (targets) {
        stages.push({ shape: spec.shape, targets, morphMs: spec.morphMs, stagger: spec.stagger, dwellMs: spec.dwellMs });
      }
    }
    if (stages.length === 0) return;
    stages.push({ shape: "portrait", targets: field.targets, morphMs: RETURN_MORPH_MS, stagger: RETURN_STAGGER, dwellMs: 0 });
    planRef.current = { kind: "surprise", stages, next: 0, timer: 0, dwellEndsAt: 0, dwellRemaining: null, holdAdvance: false };
    setView((v) => ({ ...v, phase: "surprise", shape: "transition" }));
    advanceRef.current();
  }, []);

  const onActivate = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const field = fieldRef.current;
    const pos = posRef.current;
    // 任何点击都作废等待中的开场仪式：场未就绪时同样只置标记，迟到的
    // 字形采样/揭幕回调不得再开演或覆盖后续交互。
    introAbortedRef.current = true;
    if (!field || !pos) return;
    const introOngoing = introStageRef.current === "pending" || planRef.current?.kind === "intro";
    const hadPlan = planRef.current !== null;
    const inStatic = staticShapeRef.current !== null;
    if (introOngoing) introStageRef.current = "done";
    cancelSequence();
    staticShapeRef.current = null;
    // 键盘/读屏点击（detail=0）与减少动态：无飞行、无计时，直出静态形态。
    const instant = event.detail === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant) {
      const shapes = shapesRef.current;
      if (!inStatic && !introOngoing && !hadPlan && shapes) {
        const draw = nextStaticForm(staticBagRef.current, lastShownFormRef.current, Math.random);
        staticBagRef.current = draw.bag;
        const targets = shapes[draw.form]?.[0];
        if (targets) {
          staticShapeRef.current = draw.form;
          pos.set(targets);
          void paint();
          lastShownFormRef.current = draw.form;
          setView({ phase: "static", shape: draw.form });
          return;
        }
      }
      pos.set(field.targets);
      void paint();
      setView({ phase: "idle", shape: "portrait" });
      return;
    }
    if (introOngoing || hadPlan || inStatic) {
      startReturn();
      return;
    }
    startSurprise();
  };

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    if (!button || !canvas) return;
    let disposed = false;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // 统一暂停/恢复：恢复只发生在可见、未隐藏且确有暂停中的动画时，
    // 暂停时长折算进 t0，保证回到前台从暂停处续播而不是跳帧；停留计时
    // 同步冻结剩余时长，隐藏期不吞掉可读停留。
    const pauseAnim = () => {
      const anim = animRef.current;
      if (anim?.raf) {
        pausedAtRef.current = performance.now();
        cancelAnimationFrame(anim.raf);
        anim.raf = 0;
      }
      const plan = planRef.current;
      if (plan?.timer) {
        window.clearTimeout(plan.timer);
        plan.timer = 0;
        if (plan.next === 0) {
          plan.holdAdvance = true;
        } else {
          plan.dwellRemaining = Math.max(0, plan.dwellEndsAt - performance.now());
        }
      }
    };
    const resumeAnim = () => {
      const anim = animRef.current;
      if (anim && !anim.raf && endsRef.current) {
        anim.t0 += performance.now() - pausedAtRef.current;
        anim.raf = requestAnimationFrame(step);
      }
      const plan = planRef.current;
      if (!plan || plan.timer) return;
      if (plan.dwellRemaining !== null) {
        plan.dwellEndsAt = performance.now() + plan.dwellRemaining;
        plan.timer = window.setTimeout(advanceRef.current, plan.dwellRemaining);
        plan.dwellRemaining = null;
      } else if (plan.holdAdvance) {
        plan.holdAdvance = false;
        advanceRef.current();
      }
    };

    const onVisibility = () => {
      if (document.hidden) pauseAnim();
      else if (visibleRef.current) resumeAnim();
    };
    // 会话中途开启减少动态：任何序列取消并直接落到头像终态，无残留计时。
    const onReducedChange = () => {
      if (!reducedQuery.matches) return;
      const field = fieldRef.current;
      const pos = posRef.current;
      introAbortedRef.current = true;
      introStageRef.current = "done";
      cancelSequence();
      staticShapeRef.current = null;
      if (pos && field) {
        pos.set(field.targets);
        void paint();
      }
      setView({ phase: "idle", shape: "portrait" });
    };

    const observer = new ResizeObserver(() => {
      void paint();
    });
    observer.observe(button);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);
    // 定格状态下切主题立即换墨色重绘，不打断进行中的序列。
    const themeObserver = new MutationObserver((records) => {
      if (records.some((r) => r.attributeName === "data-curation-theme")) void paint();
    });
    themeObserver.observe(document.documentElement, { attributes: true });
    const intersection = new IntersectionObserver((entries) => {
      visibleRef.current = entries.at(-1)?.isIntersecting ?? true;
      if (visibleRef.current) {
        if (!document.hidden) resumeAnim();
      } else {
        pauseAnim();
      }
    });
    intersection.observe(button);

    let unsubscribeReveal: (() => void) | null = null;
    void sampleParticleField().then(async (field) => {
      if (disposed || !field) return;
      fieldRef.current = field;
      const pos = new Float32Array(field.scatter);
      posRef.current = pos;
      // 首次绘制成功（画布上下文可用）才让粒子接管并收起静态点描，
      // 否则保留静态点描兜底，避免空白头像。
      if (!paint()) return;
      setParticlesOn(true);
      // 九形彩蛋目标同步预备：纯路径栅格化无字体等待，失败只是点击彩蛋不可用。
      shapesRef.current = buildShapeTargets(field.targets.length / 2);
      const assembleNow = () => {
        pos.set(field.targets);
        void paint();
        setView({ phase: "idle", shape: "portrait" });
      };
      // 名字序列只属于开屏仪式的首次登场：本会话已播过仪式（或要求减少动态、
      // 或等待期已被点击作废）直接停在头像终态，刷新与重挂载都不再重播。
      if (reducedQuery.matches || hasOpeningPlayedThisSession() || introAbortedRef.current) {
        introStageRef.current = "done";
        assembleNow();
        return;
      }
      setView((v) => ({ ...v, phase: "intro", shape: "transition" }));
      const stages = await buildIntroStages(name, field.targets.length / 2);
      if (disposed) return;
      if (introAbortedRef.current) return;
      stages.push({ shape: "portrait", targets: field.targets, morphMs: INTRO_AVATAR_MORPH_MS, stagger: ASSEMBLE_STAGGER, dwellMs: 0 });
      const beginIntro = (elapsedMs: number) => {
        if (disposed || introAbortedRef.current) return;
        planRef.current = { kind: "intro", stages, next: 0, timer: 0, dwellEndsAt: 0, dwellRemaining: null, holdAdvance: false };
        setView((v) => ({ ...v, phase: "intro", shape: "transition" }));
        planRef.current.timer = window.setTimeout(advanceSequence, Math.max(0, INTRO_AFTER_REVEAL_MS - elapsedMs));
      };
      // 揭幕帘升起后才开演，名字不藏在遮罩后面。字形采样恰逢帘已抬起
      // （事件已派发、DOM 未卸载）时按已流逝时间补偿立即续上，不错过
      // once 监听；帘与事件都不在说明仪式与本组件无关，直接成像兜底。
      const revealAt = getOpeningRevealAt();
      if (revealAt !== null) {
        beginIntro(performance.now() - revealAt);
        return;
      }
      if (!document.querySelector(".opening-loader")) {
        introStageRef.current = "done";
        assembleNow();
        return;
      }
      unsubscribeReveal = onOpeningReveal(() => beginIntro(0));
    });

    return () => {
      disposed = true;
      unsubscribeReveal?.();
      cancelSequence();
      observer.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      reducedQuery.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [advanceSequence, cancelSequence, name, paint, step]);

  const settledPortrait = view.phase === "idle" && view.shape === "portrait";
  return (
    <button
      ref={buttonRef}
      aria-label={settledPortrait ? `播放${name}点描头像的粒子彩蛋` : `回到${name}的点描头像`}
      className="curation-home__avatar"
      data-avatar-shape={view.shape}
      data-avatar-state={view.phase}
      data-particles={particlesOn ? "on" : "off"}
      onClick={onActivate}
      type="button"
    >
      <Image
        alt=""
        className="curation-home__avatar-stipple"
        height={105}
        preload
        src={STIPPLE_FALLBACK_SRC}
        width={105}
      />
      <canvas aria-hidden="true" className="curation-home__avatar-particles" ref={canvasRef} />
    </button>
  );
}
