"use client";

import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  getOpeningRevealAt,
  hasOpeningPlayedThisSession,
  onOpeningReveal,
} from "@/components/opening-reveal";
import {
  ADVENTURE_STATIC_TIME,
  writeAdventureFrame,
  type AdventureChapter,
} from "@/components/particle-avatar-adventure";
import {
  ARRIVAL_MORPH_MS,
  ARRIVAL_STAGGER,
  RETURN_MORPH_MS,
  RETURN_STAGGER,
} from "@/components/particle-avatar-shapes";

import {
  buildIntroStages,
  paintParticleField,
  sampleParticleField,
  type ParticleField,
  type SequenceStage,
} from "@/components/particle-avatar-field";

const STIPPLE_FALLBACK_SRC = "/images/ample-avatar-stipple-ink.png";
const INTRO_AFTER_REVEAL_MS = 850;

// DOM 相位与落定形态分开；chapter/round 仅在冒险段落边界更新。
type AvatarPhase = "idle" | "intro" | "mascot" | "returning" | "static";
type SettledShape = "portrait" | "name" | "mascot";
type AvatarShape = SettledShape | "transition";
type AvatarView = { phase: AvatarPhase; shape: AvatarShape; chapter?: AdventureChapter; round?: number };
type Selection = "portrait" | "mascot-pointer" | "mascot-static";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// morph 与 adventure 共用一个 raf；elapsed 只累计可见时间。
type MorphAnim = { kind: "morph"; t0: number; dur: number; stagger: number; raf: number; ease: (t: number) => number; then?: () => void };
type AdventureAnim = { kind: "adventure"; t0: number; raf: number };
type AnimState = MorphAnim | AdventureAnim;

// 开场与返回共用有限序列；伙伴由 adventure 循环接管。
type SequencePlan = {
  kind: "intro" | "return";
  stages: SequenceStage[];
  next: number;
  timer: number;
  dwellEndsAt: number;
  // 隐藏/离屏时停留计时同步冻结，恢复可见后续走剩余停留而不是整段吞掉。
  dwellRemaining: number | null;
  // 停留到点时被隐藏挂起的推进，恢复可见时即刻续拍。
  holdAdvance: boolean;
};

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
  const animRef = useRef<AnimState | null>(null);
  const planRef = useRef<SequencePlan | null>(null);
  // 点击/减少动态作废开场；迟到的 reveal 与字形采样不得覆盖交互。
  const introAbortedRef = useRef(false);
  // 'pending'：开场仪式尚未演完（含等待揭幕）；任何取消/播完即 'done'。
  const introStageRef = useRef<"pending" | "done">("pending");
  // step 的定格回调需要推进序列，经 ref 解开与 animateTo 的循环依赖。
  const advanceRef = useRef<() => void>(() => {});
  const pausedAtRef = useRef(0);
  const visibleRef = useRef(true);
  // 意图独立于瞬时 view/plan；指针选中可续播，键盘选中保持静止。
  const selectionRef = useRef<Selection>("portrait");
  // 冒险进度：elapsed 只在可见帧推进（t0 折算暂停时长）。
  const adventureTimeRef = useRef(0);
  // 粒子画布首次成功绘制后才接管，散开态不透出静态完整脸。
  const [particlesOn, setParticlesOn] = useState(false);
  const [view, setView] = useState<AvatarView>({ phase: "idle", shape: "portrait" });

  const paint = useCallback((): boolean => {
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    const pos = posRef.current;
    if (!canvas || !field || !pos) return false;
    return paintParticleField(canvas, field, pos);
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
      if (!anim || !field || !pos) return;
      // 冒险循环：time→帧直写粒子位，章/轮元数据只在变化时更新 React。
      if (anim.kind === "adventure") {
        const elapsed = (now - anim.t0) / 1000;
        adventureTimeRef.current = elapsed;
        const scene = writeAdventureFrame(elapsed, pos.length / 2, pos);
        paint();
        setView((v) => (v.chapter === scene.chapter && v.round === scene.round ? v : { ...v, chapter: scene.chapter, round: scene.round }));
        anim.raf = requestAnimationFrame(step);
        return;
      }
      const starts = startsRef.current;
      const ends = endsRef.current;
      if (!starts || !ends) return;
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
        const then = anim.then;
        animRef.current = null;
        // 当前段形变真实完成（仅在可见帧发生）：此刻才起停留计时，并按
        // 落定形态更新 DOM；intro/return 末段落定即序列收尾。
        const plan = planRef.current;
        const stage = plan?.stages[plan.next - 1];
        if (plan && stage) {
          const finished = plan.next >= plan.stages.length;
          setView((v) => ({ ...v, phase: finished ? "idle" : v.phase, shape: stage.shape }));
          if (finished) {
            planRef.current = null;
            if (plan.kind === "intro") introStageRef.current = "done";
            if (plan.kind === "return") {
              // 返回落定：chapter/round 一并清空。
              setView((v) => (v.chapter === undefined ? v : { ...v, chapter: undefined, round: undefined }));
            }
          } else if (!plan.timer && stage.dwellMs > 0) {
            plan.dwellEndsAt = now + stage.dwellMs;
            plan.timer = window.setTimeout(advanceRef.current, stage.dwellMs);
          }
        }
        then?.();
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
    (ends: Float32Array, dur: number, stagger: number, ease: (t: number) => number, then?: () => void) => {
      const pos = posRef.current;
      if (!pos) return;
      stopLoop();
      const starts = new Float32Array(pos);
      startsRef.current = starts;
      endsRef.current = ends;
      animRef.current = { kind: "morph", t0: performance.now(), dur, stagger, raf: 0, ease, then };
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
    const phase: AvatarPhase = stage.shape === "portrait" ? "returning" : "intro";
    setView((v) => ({ ...v, phase, shape: "transition" }));
    animateTo(stage.targets, stage.morphMs, stage.stagger, easeInOutCubic);
  }, [animateTo]);

  useEffect(() => {
    advanceRef.current = advanceSequence;
  }, [advanceSequence]);

  const beginReturn = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    cancelSequence();
    planRef.current = {
      kind: "return",
      stages: [{ shape: "portrait", targets: field.targets, morphMs: RETURN_MORPH_MS, stagger: RETURN_STAGGER, dwellMs: 0 }],
      next: 0,
      timer: 0,
      dwellEndsAt: 0,
      dwellRemaining: null,
      holdAdvance: false,
    };
    setView((v) => ({ ...v, phase: "returning", shape: "transition", chapter: undefined, round: undefined }));
    advanceRef.current();
  }, [cancelSequence]);

  // 冒险循环从 startElapsed 续播（首次为 0）：立即出首帧再交 raf；隐藏/
  // 离屏由统一的暂停/恢复路径冻结 t0，elapsed 只累计可见时间。
  const beginAdventure = useCallback(
    (startElapsed: number) => {
      const pos = posRef.current;
      if (!pos) return;
      cancelSequence();
      adventureTimeRef.current = startElapsed;
      animRef.current = { kind: "adventure", t0: performance.now() - startElapsed * 1000, raf: 0 };
      const scene = writeAdventureFrame(startElapsed, pos.length / 2, pos);
      paint();
      setView((v) => ({ ...v, phase: "mascot", shape: "mascot", chapter: scene.chapter, round: scene.round }));
      runLoop();
    },
    [cancelSequence, paint, runLoop],
  );

  const onActivate = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const field = fieldRef.current;
    const pos = posRef.current;
    // 任何点击都作废等待中的开场仪式：场未就绪时同样只置标记，迟到的
    // 字形采样/揭幕回调不得再开演或覆盖后续交互。
    introAbortedRef.current = true;
    if (!field || !pos) return;
    const introOngoing = introStageRef.current === "pending" || planRef.current?.kind === "intro";
    if (introOngoing) introStageRef.current = "done";
    // 键盘/读屏点击（detail=0）与减少动态：无飞行、无计时，直出静止形态。
    const instant = event.detail === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelSequence();
    // 开场（含等待揭幕的窗口期）首次激活一律先回头像；下一次激活才进伙伴，
    // 迟到的字形放行也不会改变这一选择。
    if (introOngoing) {
      selectionRef.current = "portrait";
      if (instant) {
        pos.set(field.targets);
        void paint();
        setView({ phase: "idle", shape: "portrait" });
        return;
      }
      beginReturn();
      return;
    }
    if (instant) {
      if (selectionRef.current === "portrait") {
        selectionRef.current = event.detail === 0 ? "mascot-static" : "mascot-pointer";
        // 键盘/减少动态定格：第一段 5s 的静止冒险帧，无飞行、无计时。
        adventureTimeRef.current = ADVENTURE_STATIC_TIME;
        const scene = writeAdventureFrame(ADVENTURE_STATIC_TIME, pos.length / 2, pos);
        void paint();
        setView({ phase: "static", shape: "mascot", chapter: scene.chapter, round: scene.round });
        return;
      }
      selectionRef.current = "portrait";
      pos.set(field.targets);
      void paint();
      setView({ phase: "idle", shape: "portrait" });
      return;
    }
    // 每次指针激活即时翻转意图：快速连点总是从当前位置反向，不排队续播。
    if (selectionRef.current === "portrait") {
      selectionRef.current = "mascot-pointer";
      // 冒险首帧作为落形目标，落定后由 then 接管连续循环。
      const ends = new Float32Array(pos.length);
      writeAdventureFrame(0, pos.length / 2, ends);
      setView((v) => ({ ...v, phase: "mascot", shape: "transition", chapter: undefined, round: undefined }));
      animateTo(ends, ARRIVAL_MORPH_MS, ARRIVAL_STAGGER, easeInOutCubic, () => beginAdventure(0));
      return;
    }
    selectionRef.current = "portrait";
    beginReturn();
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
      if (anim && !anim.raf && (anim.kind === "adventure" || endsRef.current)) {
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
    // 会话中途切换减少动态：开启时已选中的伙伴定格（循环中的冻结当前帧，
    // 静止/形变途中的直出第一段 5s 静止帧），保留选择来源；开场与返回一律
    // 落回头像。关闭时只有指针选中的伙伴从冻结进度续播，键盘定格保持静止。
    const onReducedChange = () => {
      const field = fieldRef.current;
      const pos = posRef.current;
      if (!reducedQuery.matches) {
        if (selectionRef.current === "mascot-pointer" && pos) beginAdventure(adventureTimeRef.current);
        return;
      }
      introAbortedRef.current = true;
      introStageRef.current = "done";
      const frozen = animRef.current?.kind === "adventure";
      cancelSequence();
      if (!pos || !field) return;
      if (selectionRef.current !== "portrait") {
        if (!frozen) {
          adventureTimeRef.current = ADVENTURE_STATIC_TIME;
          const scene = writeAdventureFrame(ADVENTURE_STATIC_TIME, pos.length / 2, pos);
          void paint();
          setView((v) => ({ ...v, phase: "static", shape: "mascot", chapter: scene.chapter, round: scene.round }));
        } else {
          setView((v) => ({ ...v, phase: "static" }));
        }
        return;
      }
      pos.set(field.targets);
      void paint();
      setView({ phase: "idle", shape: "portrait" });
    };

    const observer = new ResizeObserver(() => {
      void paint();
    });
    observer.observe(button);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);
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
      const stages = await buildIntroStages(name, field);
      if (disposed) return;
      if (introAbortedRef.current) return;
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
      reducedQuery.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [advanceSequence, beginAdventure, beginReturn, cancelSequence, name, paint, step]);

  const mascotSelected = view.phase === "mascot" || view.shape === "mascot";
  return (
    <button
      ref={buttonRef}
      aria-label={view.phase === "intro" || mascotSelected ? `回到${name}的点描头像` : `将${name}的点描头像变成像素小伙伴`}
      className="curation-home__avatar"
      data-avatar-chapter={view.chapter}
      data-avatar-round={view.round === undefined ? undefined : String(view.round)}
      data-avatar-shape={view.shape}
      data-avatar-state={view.phase}
      data-particles={particlesOn ? "on" : "off"}
      onClick={onActivate}
      type="button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 点描头像的静态兜底图，无需优化器 */}
      <img
        alt=""
        className="curation-home__avatar-stipple"
        fetchPriority="high"
        height={105}
        src={STIPPLE_FALLBACK_SRC}
        width={105}
      />
      <canvas aria-hidden="true" className="curation-home__avatar-particles" ref={canvasRef} />
    </button>
  );
}
