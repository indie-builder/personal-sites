"use client";

import { useEffect, useRef } from "react";

import styles from "./dot-field-ripples.module.css";

const MAX_RIPPLES = 6;
const RIPPLE_LIFETIME_MS = 1_200;
const RIPPLE_SPEED_PX_PER_MS = 0.18;
const RIPPLE_BAND_PX = 18;
const RIPPLE_AMPLITUDE_PX = 4.5;
const DOT_RADIUS_WAVE_GAIN = 0.4;
const MOVE_MIN_INTERVAL_MS = 75;
const MOVE_MIN_TRAVEL_PX = 14;
const DPR_MAX = 2;
const TAU = Math.PI * 2;

export type DotRipple = { at: number; x: number; y: number };

// 单圈波纹对格点 (x, y) 的作用：返回径向单位位移（调用方乘振幅）与 0..1 波强。
// 波带窗口随波龄外扩并线性衰减，到期或带外恒为零；原点处方向未定义，只保留波强。
export function rippleEffect(
  ripple: DotRipple,
  x: number,
  y: number,
  now: number,
): { dx: number; dy: number; wave: number } {
  const age = now - ripple.at;
  const fade = 1 - age / RIPPLE_LIFETIME_MS;
  if (fade <= 0) return { dx: 0, dy: 0, wave: 0 };
  const ox = x - ripple.x;
  const oy = y - ripple.y;
  const distance = Math.hypot(ox, oy);
  const band = Math.max(0, 1 - Math.abs(distance - RIPPLE_SPEED_PX_PER_MS * age) / RIPPLE_BAND_PX);
  const wave = band * fade;
  if (wave === 0 || distance === 0) return { dx: 0, dy: 0, wave };
  return { dx: (ox / distance) * wave, dy: (oy / distance) * wave, wave };
}

export function DotFieldRipples() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ripples: DotRipple[] = [];
    let raf = 0;
    let armed = false;
    let visible = true;
    let bounds: DOMRect | null = null;
    let spacing = 9;
    let ink = "";
    let cssWidth = 0;
    let cssHeight = 0;
    let lastRippleAt = Number.NEGATIVE_INFINITY;
    let lastX = 0;
    let lastY = 0;

    const paint = (now: number) => {
      if (!armed || cssWidth === 0 || cssHeight === 0) return;
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = ink;
      const half = spacing / 2;
      ctx.beginPath();
      for (let y = half; y < cssHeight; y += spacing) {
        for (let x = half; x < cssWidth; x += spacing) {
          let dx = 0;
          let dy = 0;
          let wave = 0;
          for (const ripple of ripples) {
            const effect = rippleEffect(ripple, x, y, now);
            dx += effect.dx;
            dy += effect.dy;
            if (effect.wave > wave) wave = effect.wave;
          }
          const px = x + dx * RIPPLE_AMPLITUDE_PX;
          const py = y + dy * RIPPLE_AMPLITUDE_PX;
          const radius = 1 + wave * DOT_RADIUS_WAVE_GAIN;
          ctx.moveTo(px + radius, py);
          ctx.arc(px, py, radius, 0, TAU);
        }
      }
      ctx.fill();
    };

    const frame = (now: number) => {
      raf = 0;
      ripples = ripples.filter((ripple) => now - ripple.at < RIPPLE_LIFETIME_MS);
      paint(now);
      if (ripples.length > 0) raf = requestAnimationFrame(frame);
      else canvas.removeAttribute("data-rippling");
    };

    const stopWaves = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ripples = [];
      canvas.removeAttribute("data-rippling");
    };

    const syncMetrics = () => {
      const computed = getComputedStyle(parent);
      spacing = Number.parseFloat(computed.backgroundSize) || 9;
      ink = computed.getPropertyValue("--dot-field-ink").trim() || "rgb(28 28 30 / 27%)";
    };

    const resize = () => {
      if (!armed) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      cssWidth = width;
      cssHeight = height;
      if (width === 0 || height === 0) {
        stopWaves();
        parent.removeAttribute("data-dot-ripples");
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncMetrics();
      paint(performance.now());
      parent.dataset.dotRipples = "ready";
    };

    const disable = () => {
      armed = false;
      stopWaves();
      parent.removeAttribute("data-dot-ripples");
      if (cssWidth > 0 && cssHeight > 0) ctx.clearRect(0, 0, cssWidth, cssHeight);
    };

    const onPointerEnter = () => {
      bounds = parent.getBoundingClientRect();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!armed || event.pointerType !== "mouse" || document.hidden || !visible) return;
      const now = performance.now();
      if (now - lastRippleAt < MOVE_MIN_INTERVAL_MS) return;
      if (!bounds) bounds = parent.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (Number.isFinite(lastRippleAt) && Math.hypot(x - lastX, y - lastY) < MOVE_MIN_TRAVEL_PX) return;
      lastRippleAt = now;
      lastX = x;
      lastY = y;
      ripples.push({ at: now, x, y });
      if (ripples.length > MAX_RIPPLES) ripples.splice(0, ripples.length - MAX_RIPPLES);
      if (!raf) {
        canvas.dataset.rippling = "true";
        raf = requestAnimationFrame(frame);
      }
    };

    const onScroll = () => {
      bounds = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopWaves();
        paint(performance.now());
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      bounds = null;
      resize();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (!visible) {
        stopWaves();
        paint(performance.now());
      }
    });
    const themeObserver = new MutationObserver((records) => {
      if (!armed || !records.some((record) => record.attributeName === "data-curation-theme")) return;
      syncMetrics();
      if (!raf) paint(performance.now());
    });
    const syncMotionPolicy = () => {
      if (reducedQuery.matches || !fineQuery.matches) disable();
      else {
        armed = true;
        resize();
      }
    };

    parent.addEventListener("pointerenter", onPointerEnter, { passive: true });
    parent.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", syncMotionPolicy);
    fineQuery.addEventListener("change", syncMotionPolicy);
    themeObserver.observe(document.documentElement, { attributes: true });
    resizeObserver.observe(parent);
    intersection.observe(parent);
    syncMotionPolicy();

    return () => {
      disable();
      parent.removeEventListener("pointerenter", onPointerEnter);
      parent.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", syncMotionPolicy);
      fineQuery.removeEventListener("change", syncMotionPolicy);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, []);

  return <canvas aria-hidden="true" className={styles.canvas} ref={canvasRef} />;
}
