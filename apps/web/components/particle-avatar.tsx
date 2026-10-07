"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const STIPPLE_SRC = "/images/ample-avatar-stipple.png";
const STIPPLE_FALLBACK_SRC = "/images/ample-avatar-stipple-ink.png";
const TARGET_COUNT = 700;
const MAX_COUNT = 4000;
const ASSEMBLE_MS = 1000;
const TOGGLE_MS = 720;
const ASSEMBLE_STAGGER = 240;
const TOGGLE_STAGGER = 110;
const TAU = Math.PI * 2;
// 等面积圆在高频下会被抗锯齿稀释成浅灰；放大半径补回点描图实心墨点
// （中位等价半径约 1.13 源像素）的视觉重量。
const DOT_GAIN = 1.45;

// 进站聚合动画每个页面会话只播一次，客户端导航重挂载直接停在成像终态。
let playedIntro = false;

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

type ParticleField = {
  targets: Float32Array;
  scatter: Float32Array;
  delays: Float32Array;
  radii: Float32Array;
  sourceSize: number;
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
  const animRef = useRef<{ t0: number; dur: number; stagger: number; raf: number } | null>(null);
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
        const e = easeOutCubic(t);
        pos[i] = starts[i] + (ends[i] - starts[i]) * e;
        pos[i + 1] = starts[i + 1] + (ends[i + 1] - starts[i + 1]) * e;
      }
      paint();
      if (settled) {
        animRef.current = null;
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
    (ends: Float32Array, dur: number, stagger: number) => {
      const pos = posRef.current;
      if (!pos) return;
      stopLoop();
      const starts = new Float32Array(pos);
      startsRef.current = starts;
      endsRef.current = ends;
      animRef.current = { t0: performance.now(), dur, stagger, raf: 0 };
      runLoop();
    },
    [runLoop, stopLoop],
  );

  const toggle = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
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
  }, [animateTo, assembled, paint, stopLoop]);

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
      if (!anim || anim.raf || !endsRef.current) return;
      anim.t0 += performance.now() - pausedAtRef.current;
      anim.raf = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (document.hidden) pauseAnim();
      else if (visibleRef.current) resumeAnim();
    };
    // 会话中途开启减少动态：停止当前动画并直接落到当前目标终态。
    const onReducedChange = () => {
      if (!reducedQuery.matches) return;
      const ends = endsRef.current;
      const pos = posRef.current;
      stopLoop();
      animRef.current = null;
      if (pos && ends) {
        pos.set(ends);
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

    void sampleParticleField().then((field) => {
      if (disposed || !field) return;
      fieldRef.current = field;
      const pos = new Float32Array(field.scatter);
      posRef.current = pos;
      // 首次绘制成功（画布上下文可用）才让粒子接管并收起静态点描，
      // 否则保留静态点描兜底，避免空白头像。
      if (!paint()) return;
      setParticlesOn(true);
      if (reducedQuery.matches || playedIntro) {
        pos.set(field.targets);
        void paint();
      } else {
        playedIntro = true;
        animateTo(field.targets, ASSEMBLE_MS, ASSEMBLE_STAGGER);
      }
    });

    return () => {
      disposed = true;
      observer.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      reducedQuery.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      stopLoop();
      animRef.current = null;
    };
  }, [animateTo, paint, step, stopLoop]);

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
