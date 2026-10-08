"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getOpeningRevealAt,
  hasOpeningPlayedThisSession,
  onOpeningReveal,
} from "@/components/opening-reveal";

const STIPPLE_SRC = "/images/ample-avatar-stipple.png";
const STIPPLE_FALLBACK_SRC = "/images/ample-avatar-stipple-ink.png";
const TARGET_COUNT = 700;
const MAX_COUNT = 4000;
const TOGGLE_MS = 720;
const ASSEMBLE_STAGGER = 240;
const TOGGLE_STAGGER = 110;
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

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

// 字与字之间的形变全程在画面上移动，用 in-out 曲线读作「重组」而不是「到达」。
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

// 名字序列的一段：粒子飞往 targets 停 dwellMs 后进入下一段；最终段是头像。
type IntroStage = {
  targets: Float32Array;
  morphMs: number;
  stagger: number;
  dwellMs: number;
};

type IntroPlan = {
  stages: IntroStage[];
  next: number;
  timer: number;
  // 停留计时在隐藏/离屏时到点后置位，恢复可见时由恢复路径推进。
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

async function buildIntroStages(name: string, count: number): Promise<IntroStage[]> {
  const stages: IntroStage[] = [];
  for (const char of [...name]) {
    if (!char.trim()) continue;
    const targets = await sampleGlyphField(char, count);
    if (targets) {
      stages.push({ targets, morphMs: INTRO_CHAR_MORPH_MS, stagger: INTRO_CHAR_STAGGER, dwellMs: INTRO_CHAR_DWELL_MS });
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
  const introRef = useRef<IntroPlan | null>(null);
  // 开场序列整体生命周期的作废标记：等待揭幕的窗口期内点击/开启减少
  // 动态同样作废，迟到的 reveal 回调不得再开演。
  const introAbortedRef = useRef(false);
  // step 的定格回调需要推进序列，经 ref 解开与 animateTo 的循环依赖。
  const advanceIntroRef = useRef<() => void>(() => {});
  const pausedAtRef = useRef(0);
  const visibleRef = useRef(true);
  const [assembled, setAssembled] = useState(true);
  // 粒子画布首次成功绘制后才接管，散开态不透出静态完整脸。
  const [particlesOn, setParticlesOn] = useState(false);

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
        // 开场序列的当前段形变真实完成（仅在可见帧发生）：此刻才起停留
        // 计时，后台/离屏暂停不会吞掉字形的可读停留。
        const intro = introRef.current;
        const stage = intro?.stages[intro.next - 1];
        if (intro && stage && !intro.timer) {
          intro.timer = window.setTimeout(advanceIntroRef.current, stage.dwellMs);
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
    (ends: Float32Array, dur: number, stagger: number, ease: (t: number) => number = easeOutCubic) => {
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

  const cancelIntro = useCallback(() => {
    introAbortedRef.current = true;
    const intro = introRef.current;
    if (!intro) return;
    if (intro.timer) window.clearTimeout(intro.timer);
    introRef.current = null;
  }, []);

  // 开场序列的节拍器：每段形变由 animateTo 驱动，定格时 step 回调按该段
  // dwellMs 起停留计时再进下一段；到点时不可见则挂起，交恢复路径续拍。
  const advanceIntro = useCallback(
    function advanceIntro() {
      const intro = introRef.current;
      if (!intro) return;
      intro.timer = 0;
      // 后台标签/滚出视口：不推进也不轮询，回到可见时由 resumeAnim 续拍。
      if (document.hidden || !visibleRef.current) {
        intro.holdAdvance = true;
        return;
      }
      const stage = intro.stages[intro.next];
      intro.next += 1;
      if (!stage) {
        introRef.current = null;
        return;
      }
      animateTo(stage.targets, stage.morphMs, stage.stagger, easeInOutCubic);
    },
    [animateTo],
  );

  useEffect(() => {
    advanceIntroRef.current = advanceIntro;
  }, [advanceIntro]);

  const toggle = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    // 开场序列中点击：取消余下段落，从当前位置直接进入散开/聚拢切换。
    cancelIntro();
    const nextAssembled = !assembled;
    setAssembled(nextAssembled);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stopLoop();
      animRef.current = null;
      posRef.current = new Float32Array(nextAssembled ? field.targets : field.scatter);
      void paint();
      return;
    }
    animateTo(nextAssembled ? field.targets : field.scatter, TOGGLE_MS, TOGGLE_STAGGER);
  }, [animateTo, assembled, cancelIntro, paint, stopLoop]);

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    if (!button || !canvas) return;
    let disposed = false;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // 统一暂停/恢复：恢复只发生在可见、未隐藏且确有暂停中的动画时，
    // 暂停时长折算进 t0，保证回到前台从暂停处续播而不是跳帧。
    const pauseAnim = () => {
      const anim = animRef.current;
      if (anim?.raf) {
        pausedAtRef.current = performance.now();
        cancelAnimationFrame(anim.raf);
        anim.raf = 0;
      }
    };
    const resumeAnim = () => {
      const anim = animRef.current;
      if (anim && !anim.raf && endsRef.current) {
        anim.t0 += performance.now() - pausedAtRef.current;
        anim.raf = requestAnimationFrame(step);
      }
      // 停留到点时被隐藏挂起的序列：回到可见即刻续拍。
      const intro = introRef.current;
      if (intro?.holdAdvance) {
        intro.holdAdvance = false;
        advanceIntroRef.current();
      }
    };

    const onVisibility = () => {
      if (document.hidden) pauseAnim();
      else if (visibleRef.current) resumeAnim();
    };
    // 会话中途开启减少动态：开场序列取消并直接落到头像终态；
    // 普通聚散切换的飞行仍落其当前目标，不覆盖用户刚表达的意图。
    const onReducedChange = () => {
      if (!reducedQuery.matches) return;
      const field = fieldRef.current;
      const pos = posRef.current;
      const introActive = introRef.current !== null;
      cancelIntro();
      stopLoop();
      animRef.current = null;
      if (pos && field) {
        pos.set(introActive ? field.targets : (endsRef.current ?? field.targets));
        void paint();
      }
    };

    const observer = new ResizeObserver(() => {
      void paint();
    });
    observer.observe(button);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);
    // 定格状态下切主题立即换墨色重绘。
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
      const assembleNow = () => {
        pos.set(field.targets);
        void paint();
      };
      // 名字序列只属于开屏仪式的首次登场：本会话已播过仪式（或要求减少动态）
      // 直接停在头像终态，刷新与客户端导航重挂载都不再重播。
      if (reducedQuery.matches || hasOpeningPlayedThisSession()) {
        assembleNow();
        return;
      }
      const stages = await buildIntroStages(name, field.targets.length / 2);
      if (disposed) return;
      stages.push({ targets: field.targets, morphMs: INTRO_AVATAR_MORPH_MS, stagger: ASSEMBLE_STAGGER, dwellMs: 0 });
      const beginIntro = (elapsedMs: number) => {
        if (disposed || introAbortedRef.current) return;
        introRef.current = { stages, next: 0, timer: 0, holdAdvance: false };
        introRef.current.timer = window.setTimeout(advanceIntro, Math.max(0, INTRO_AFTER_REVEAL_MS - elapsedMs));
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
        assembleNow();
        return;
      }
      unsubscribeReveal = onOpeningReveal(() => beginIntro(0));
    });

    return () => {
      disposed = true;
      unsubscribeReveal?.();
      cancelIntro();
      observer.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      reducedQuery.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      stopLoop();
      animRef.current = null;
    };
  }, [advanceIntro, cancelIntro, name, paint, step, stopLoop]);

  return (
    <button
      ref={buttonRef}
      aria-label={assembled ? `分散${name}的点描头像` : `聚拢${name}的点描头像`}
      className="curation-home__avatar"
      data-particles={particlesOn ? "on" : "off"}
      onClick={toggle}
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
