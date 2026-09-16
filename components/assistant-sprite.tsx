"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ask-assistant.module.css";

// Pixel geometry and two walking frames observed on joeypescatore.com (Ovid).
export function AssistantSprite() {
  return (
    <svg aria-hidden="true" viewBox="0 0 27 32" width="17" height={544 / 27} shapeRendering="crispEdges" className={styles.sprite}>
      <g fill="currentColor">
        <rect x="0" y="0" width="8" height="24" />
        <rect x="12" y="0" width="8" height="8" />
        <rect x="7" y="4" width="16" height="4" />
        <rect x="12" y="4" width="4" height="12" />
        <rect x="20" y="4" width="4" height="12" />
        <rect x="7" y="12" width="20" height="4" />
        <rect x="4" y="15" width="19" height="13" />
        <rect x="8" y="15" width="4" height="13" />
        <rect x="16" y="20" width="4" height="8" />
        <g className={styles.feetA}><rect x="8" y="28" width="4" height="4" /><rect x="16" y="28" width="4" height="4" /></g>
        <g className={styles.feetB}><rect x="10" y="28" width="4" height="4" /><rect x="14" y="28" width="4" height="4" /></g>
      </g>
    </svg>
  );
}

export function SpriteWalker({ children, paused = false }: { children?: ReactNode; paused?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const lane = useRef(0);
  const stage = useRef<"walk" | "jump">("walk");
  const layoutSize = useRef("");
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(children);

  useEffect(() => {
    const rail = track.current;
    const element = walker.current;
    if (!rail || !element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let animation: Animation | undefined;
    let landing: Animation | undefined;
    let disposed = false;
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const transform = (x: number, y: number) => `translate(${x}px, ${y}px)`;
    const canMove = () => !disposed && !paused && !hovered && !reduced.matches && !document.hidden;
    function lanes() {
      const origin = rail!.getBoundingClientRect();
      const rows = interactive
        ? [...(rail!.closest(".curation-home__bio")?.querySelectorAll<HTMLElement>("[data-profile-line]") ?? [])]
        : [];
      if (rows.length) return rows.map((node) => {
          const rect = node.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(node);
          const textRight = range.getBoundingClientRect().right;
          return { left: rect.left - origin.left, right: Math.max(rect.left, textRight - 17) - origin.left, y: rect.top - origin.top - 26, node };
        });
      return [{ left: 0, right: Math.max(0, rail!.clientWidth - 30), y: 0, node: null as HTMLElement | null }];
    }
    function stop() {
      clearTimeout(timer);
      if (animation) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element!).transform);
        position.current = { x: matrix.m41, y: matrix.m42 };
        element!.style.transform = transform(position.current.x, position.current.y);
        animation.cancel();
        animation = undefined;
      }
      element!.dataset.walking = "false";
    }
    function walk() {
      if (!canMove()) return;
      const route = lanes();
      lane.current = Math.min(lane.current, route.length - 1);
      const jumping = interactive && route.length > 1 && stage.current === "jump";
      const nextLane = jumping ? (lane.current + 1) % route.length : lane.current;
      const destination = route[nextLane];
      // Alternating directions avoids a distracting full-width jump at each line end.
      const rightward = nextLane % 2 === 0;
      const x = interactive
        ? jumping ? (rightward ? destination.left : destination.right) : (rightward ? destination.right : destination.left)
        : random(0, Math.max(0, rail!.clientWidth - 17));
      const y = destination.y;
      const from = position.current;
      const distance = Math.abs(x - from.x);
      const duration = jumping ? 440 : Math.max(300, distance / 0.05);
      element!.style.setProperty("--facing", jumping ? (rightward ? "1" : "-1") : x >= from.x ? "1" : "-1");
      element!.dataset.walking = String(!jumping);
      element!.dataset.motion = jumping ? "jump" : "walk";
      const returning = jumping && nextLane === 0;
      const frames = returning ? [
        { transform: transform(from.x, from.y), opacity: 1, offset: 0 },
        { transform: transform(from.x, from.y + 8), opacity: 0, offset: .4 },
        { transform: transform(x, y + 8), opacity: 0, offset: .5 },
        { transform: transform(x, y), opacity: 1, offset: 1 },
      ] : jumping ? [
        { transform: transform(from.x, from.y), offset: 0 },
        { transform: transform(from.x + (x - from.x) * .5, Math.min(from.y, y) - 18), offset: .42 },
        { transform: transform(x, y), offset: 1 },
      ] : [{ transform: transform(from.x, from.y) }, { transform: transform(x, y) }];
      const movement = element!.animate(frames, {
        duration,
        easing: jumping ? "cubic-bezier(.33,0,.67,1)" : `steps(${Math.max(2, Math.round(distance / 4))}, end)`,
        fill: "forwards",
      });
      animation = movement;
      animation.finished.then(() => {
        if (disposed || animation !== movement) return;
        position.current = { x, y };
        lane.current = nextLane;
        element!.dataset.lane = String(nextLane);
        element!.style.transform = transform(x, y);
        movement.cancel();
        animation = undefined;
        element!.dataset.walking = "false";
        if (jumping && destination.node) {
          landing?.cancel();
          landing = destination.node.animate([
            { transform: "translateY(0)" },
            { transform: "translateY(4px)", offset: .3 },
            { transform: "translateY(-1px)", offset: .7 },
            { transform: "translateY(0)" },
          ], { duration: 300, easing: "ease-out" });
        }
        stage.current = jumping ? "walk" : "jump";
        if (canMove()) timer = setTimeout(walk, interactive ? (jumping ? 360 : 450) : random(1200, 3500));
      }).catch(() => {});
    }
    function resume(reflow = false) {
      stop();
      if (reduced.matches) {
        landing?.cancel();
        position.current = { x: 0, y: 0 };
        lane.current = 0;
        stage.current = "walk";
      } else if (reflow) {
        const route = lanes();
        lane.current = Math.min(lane.current, route.length - 1);
        const row = route[lane.current];
        position.current = { x: Math.max(row.left, Math.min(position.current.x, row.right)), y: row.y };
      }
      element!.style.transform = transform(position.current.x, position.current.y);
      if (canMove()) timer = setTimeout(walk, random(300, 800));
    }
    const bio = rail.closest(".curation-home__bio");
    const observer = new ResizeObserver(() => {
      const size = `${rail.clientWidth}:${bio?.clientHeight ?? rail.clientHeight}`;
      if (size === layoutSize.current) return;
      layoutSize.current = size;
      resume(true);
    });
    observer.observe(rail);
    if (bio) observer.observe(bio);
    const resumeWithoutReflow = () => resume();
    reduced.addEventListener("change", resumeWithoutReflow);
    document.addEventListener("visibilitychange", resumeWithoutReflow);
    resume();
    return () => {
      disposed = true;
      stop();
      landing?.cancel();
      observer.disconnect();
      reduced.removeEventListener("change", resumeWithoutReflow);
      document.removeEventListener("visibilitychange", resumeWithoutReflow);
    };
  }, [paused, hovered, interactive]);

  return (
    <div ref={track} className={styles.track}>
      <div ref={walker} className={styles.walker} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
        {children ?? <AssistantSprite />}
      </div>
    </div>
  );
}
