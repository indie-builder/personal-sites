"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { instantMotion } from "@/lib/portfolio/motion";

import { PlaybackToggle, PreviewPlaybackScope } from "./preview-playback";
import styles from "./portfolio-overview.module.css";

const HISTORY_KEY = "portfolioTimeline";
const SESSION_KEY = "personal-site:portfolio-return:v1";
const SETTLE_MS = 150;
const DRAG_THRESHOLD = 6;
const FUTURE = "future";

type Snapshot = {
  v: 1;
  slug: string;
  offset: number;
  viewportWidth: number;
  focus: "link" | "viewport" | "none";
};

function parseSnapshot(raw: unknown): Snapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (typeof record.slug !== "string" || record.slug.length === 0) return null;
  if (typeof record.offset !== "number" || !Number.isFinite(record.offset) || record.offset < 0) return null;
  if (typeof record.viewportWidth !== "number" || !Number.isFinite(record.viewportWidth) || record.viewportWidth <= 0) {
    return null;
  }
  if (record.focus !== "link" && record.focus !== "viewport" && record.focus !== "none") return null;
  return {
    v: 1,
    slug: record.slug,
    offset: record.offset,
    viewportWidth: record.viewportWidth,
    focus: record.focus,
  };
}

function parseStoredSnapshot(raw: string | null): Snapshot | null {
  if (raw === null) return null;
  try {
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

type Station = { key: string; element: HTMLElement; link: HTMLAnchorElement | null };

function readStations(viewport: HTMLElement): Station[] {
  const list = viewport.querySelector<HTMLElement>("ol[data-timeline-list]");
  if (!list) return [];
  return [...list.children]
    .filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        (child.dataset.timelineStop !== undefined || child.dataset.timelineEnd !== undefined),
    )
    .map((element) => ({
      key: element.dataset.timelineStop ?? FUTURE,
      element,
      link: element.querySelector<HTMLAnchorElement>("a[data-portfolio-work]"),
    }));
}

function captionText(name: string | undefined, index: number, products: number): string {
  if (name === undefined) return "";
  return index < products ? `${name} · ${index + 1} / ${products}` : "未完待续";
}

type DragState =
  | { phase: "idle" }
  | { phase: "candidate"; startX: number; startScroll: number }
  | { phase: "dragging"; startX: number; startScroll: number };

export function PortfolioTimeline({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cancelRestoreRef = useRef(() => {});
  const stationsRef = useRef<Station[]>([]);
  const leftsRef = useRef<number[]>([]);
  const insetRef = useRef<number | null>(null);
  const maxRef = useRef(0);
  const activeRef = useRef(0);
  const pendingTargetRef = useRef<number | null>(null);
  const dragRef = useRef<DragState>({ phase: "idle" });
  const suppressClickRef = useRef(false);
  const phaseRef = useRef<"restoring" | "ready">("restoring");

  const [stops, setStops] = useState<{ key: string; name: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bounds, setBounds] = useState({ previous: true, next: false });
  const [announced, setAnnounced] = useState("");

  const contentLeft = (viewport: HTMLElement, element: HTMLElement) =>
    element.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;

  const updateBounds = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const left = viewport.scrollLeft;
    const max = maxRef.current;
    setBounds((current) =>
      current.previous === left <= 2 && current.next === left >= max - 2
        ? current
        : { previous: left <= 2, next: left >= max - 2 },
    );
  };

  const measure = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const stations = readStations(viewport);
    if (!stations.length) return;
    stationsRef.current = stations;
    if (viewport.scrollLeft === 0 && insetRef.current === null) {
      insetRef.current = contentLeft(viewport, stations[0].element);
    }
    leftsRef.current = stations.map((station) => contentLeft(viewport, station.element));
    maxRef.current = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setStops(stations.map((station) => ({ key: station.key, name: station.element.dataset.name ?? "" })));
    updateBounds();
  };

  const applyActive = (index: number) => {
    if (index < 0 || index === activeRef.current) return;
    activeRef.current = index;
    setActiveIndex(index);
  };

  const nearest = () => {
    const viewport = viewportRef.current;
    const lefts = leftsRef.current;
    if (!viewport || !lefts.length) return -1;
    const target = viewport.scrollLeft + (insetRef.current ?? 0);
    let best = -1;
    let bestDistance = Infinity;
    lefts.forEach((left, index) => {
      const distance = Math.abs(left - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const scrollToViewport = (left: number, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const clamped = Math.max(0, Math.min(maxRef.current, left));
    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({ left: clamped, behavior });
    } else {
      viewport.scrollLeft = clamped;
    }
  };

  const goTo = (index: number, behavior: ScrollBehavior): number => {
    const lefts = leftsRef.current;
    if (index < 0 || index >= lefts.length) return -1;
    const target = lefts[index] - (insetRef.current ?? 0);
    pendingTargetRef.current = target;
    scrollToViewport(target, behavior);
    applyActive(index);
    return index;
  };

  const step = (direction: 1 | -1, behavior: ScrollBehavior): number => {
    const viewport = viewportRef.current;
    const lefts = leftsRef.current;
    if (!viewport || !lefts.length) return -1;
    const aligned = (pendingTargetRef.current ?? viewport.scrollLeft) + (insetRef.current ?? 0);
    let target = -1;
    if (direction === 1) {
      target = lefts.findIndex((left) => left > aligned + 1);
    } else {
      for (let index = lefts.length - 1; index >= 0; index -= 1) {
        if (lefts[index] < aligned - 1) {
          target = index;
          break;
        }
      }
    }
    if (target === -1) {
      pendingTargetRef.current = null;
      return -1;
    }
    return goTo(target, behavior);
  };

  const currentFocus = (viewport: HTMLElement): Snapshot["focus"] => {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLAnchorElement &&
      focused.dataset.portfolioWork !== undefined &&
      viewport.contains(focused)
    ) {
      return "link";
    }
    return focused === viewport ? "viewport" : "none";
  };

  /** 只在 ready 后写入；合并既有 history.state，不覆盖 Next 的键。 */
  const save = (focus: Snapshot["focus"], slug?: string): Snapshot | null => {
    const viewport = viewportRef.current;
    const stations = stationsRef.current;
    if (!viewport || phaseRef.current !== "ready" || !stations.length) return null;
    const index = slug === undefined ? activeRef.current : stations.findIndex((station) => station.key === slug);
    if (index === -1) return null;
    const snapshot: Snapshot = {
      v: 1,
      slug: stations[index].key,
      offset: viewport.scrollLeft,
      viewportWidth: Math.max(1, viewport.clientWidth),
      focus,
    };
    try {
      history.replaceState({ ...history.state, [HISTORY_KEY]: snapshot }, "");
    } catch {
    }
    return snapshot;
  };

  const applyPlan = (index: number, snapshot: Snapshot | null, focusLink: boolean) => {
    const viewport = viewportRef.current;
    const lefts = leftsRef.current;
    if (!viewport) return;
    const inset = insetRef.current ?? 0;
    const width = Math.max(1, viewport.clientWidth);
    let left: number | null = null;
    if (snapshot && Math.abs(width - snapshot.viewportWidth) <= 1) {
      left = Math.max(0, Math.min(maxRef.current, snapshot.offset));
    } else if (lefts[index] !== undefined) {
      left = Math.max(0, Math.min(maxRef.current, lefts[index] - inset));
    }
    phaseRef.current = "restoring";
    if (left !== null) viewport.scrollLeft = left;
    applyActive(index);
    const link = focusLink ? stationsRef.current[index]?.link : null;
    if (link) link.focus({ preventScroll: true });
    else if (snapshot?.focus === "viewport") viewport.focus({ preventScroll: true });
    phaseRef.current = "ready";
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const node = event.target as HTMLElement | null;
    const onViewport = node === viewportRef.current;
    const onWorkLink = node instanceof HTMLElement && node.dataset.portfolioWork !== undefined;
    if (!onViewport && !onWorkLink) return;
    let target = -1;
    if (event.key === "ArrowLeft") target = step(-1, "instant");
    else if (event.key === "ArrowRight") target = step(1, "instant");
    else if (event.key === "Home") target = goTo(0, "instant");
    else if (event.key === "End") target = goTo(leftsRef.current.length - 1, "instant");
    else return;
    event.preventDefault();
    if (!onWorkLink || target < 0) return;
    const station = stationsRef.current[target];
    if (station?.link) station.link.focus({ preventScroll: true });
    else viewportRef.current?.focus({ preventScroll: true });
  };

  const handleStepButton = (direction: 1 | -1) => {
    cancelRestoreRef.current();
    const behavior: ScrollBehavior = instantMotion() || document.hidden ? "instant" : "smooth";
    const target = step(direction, behavior);
    if (target < 0) return;
    const stations = stationsRef.current;
    setAnnounced(captionText(stations[target]?.element.dataset.name, target, stations.length - 1));
  };

  const handleFocus = (event: ReactFocusEvent<HTMLElement>) => {
    if (phaseRef.current === "restoring") return;
    const node = event.target;
    if (!(node instanceof HTMLAnchorElement) || node.dataset.portfolioWork === undefined) return;
    const index = stationsRef.current.findIndex((station) => station.link === node);
    if (index === -1) return;
    pendingTargetRef.current = null;
    applyActive(index);
    if (document.documentElement.dataset.input === "keyboard") {
      scrollToViewport(leftsRef.current[index] - (insetRef.current ?? 0), "instant");
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    pendingTargetRef.current = null;
    suppressClickRef.current = false;
    const viewport = viewportRef.current;
    if (!viewport || event.pointerType !== "mouse" || event.button !== 0 || maxRef.current <= 0) return;
    dragRef.current = { phase: "candidate", startX: event.clientX, startScroll: viewport.scrollLeft };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const viewport = viewportRef.current;
    const state = dragRef.current;
    if (!viewport || state.phase === "idle") return;
    if (state.phase === "candidate") {
      if (event.buttons !== 1) {
        dragRef.current = { phase: "idle" };
        return;
      }
      if (Math.abs(event.clientX - state.startX) <= DRAG_THRESHOLD) return;
      dragRef.current = { phase: "dragging", startX: state.startX, startScroll: state.startScroll };
      viewport.setPointerCapture(event.pointerId);
      viewport.dataset.dragging = "true";
      suppressClickRef.current = true;
    }
    viewport.scrollLeft = state.startScroll - (event.clientX - state.startX);
  };

  const endDrag = (event?: ReactPointerEvent<HTMLElement>) => {
    const viewport = viewportRef.current;
    const state = dragRef.current;
    dragRef.current = { phase: "idle" };
    if (!viewport || state.phase !== "dragging") return;
    delete viewport.dataset.dragging;
    if (event && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  const cancelDrag = () => {
    suppressClickRef.current = false;
    endDrag();
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (suppressClickRef.current && event.detail !== 0) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    handleClick(event);
  };

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const node = event.target as HTMLElement;
    const link = node.closest?.("a[data-portfolio-work]");
    if (!(link instanceof HTMLAnchorElement)) return;
    const slug = link.closest("li")?.dataset.timelineStop;
    if (!slug) return;
    const snapshot = save("link", slug);
    if (!snapshot) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // 会话存储不可用时仅失去显式返回，链接照常工作。
    }
  };

  useEffect(() => {
    stationsRef.current.forEach((station, index) => {
      if (index === activeIndex) station.element.dataset.active = "true";
      else delete station.element.dataset.active;
    });
  }, [activeIndex, stops]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let disposed = false;
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    measure();
    if (!stationsRef.current.length) {
      phaseRef.current = "ready";
      return;
    }

    const historySnapshot = parseSnapshot(history.state?.[HISTORY_KEY]);
    const requested = /^#portfolio-work-(.+)$/.exec(window.location.hash)?.[1];
    const hashSlug = requested && stationsRef.current.some((station) => station.key === requested) ? requested : null;
    let sessionSnapshot: Snapshot | null = null;
    try {
      sessionSnapshot = parseStoredSnapshot(sessionStorage.getItem(SESSION_KEY));
    } catch {
      sessionSnapshot = null;
    }

    let planIndex = 0;
    let planSnapshot: Snapshot | null = null;
    let planFocusLink = false;
    if (historySnapshot && stationsRef.current.some((station) => station.key === historySnapshot.slug)) {
      planIndex = stationsRef.current.findIndex((station) => station.key === historySnapshot.slug);
      planSnapshot = historySnapshot;
      planFocusLink = historySnapshot.focus === "link";
    } else if (hashSlug !== null) {
      planIndex = Math.max(0, stationsRef.current.findIndex((station) => station.key === hashSlug));
      if (sessionSnapshot && sessionSnapshot.slug === hashSlug) planSnapshot = sessionSnapshot;
      planFocusLink = true;
    }
    applyPlan(planIndex, planSnapshot, planFocusLink);
    phaseRef.current = "restoring";
    // Next may apply the URL hash after mount; settle the destination snapshot after that commit.
    let restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        if (!disposed) applyPlan(planIndex, planSnapshot, planFocusLink);
      });
    });
    const interruptRestore = () => {
      cancelAnimationFrame(restoreFrame);
      restoreFrame = 0;
      phaseRef.current = "ready";
    };
    cancelRestoreRef.current = interruptRestore;
    const root = viewport.parentElement;
    root?.addEventListener("pointerdown", interruptRestore, { passive: true, capture: true });
    root?.addEventListener("keydown", interruptRestore, { capture: true });
    viewport.addEventListener("wheel", interruptRestore, { passive: true });

    const onScroll = () => {
      if (phaseRef.current === "restoring") return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const index = nearest();
        if (index >= 0) applyActive(index);
        updateBounds();
      });
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settleTimer = undefined;
        pendingTargetRef.current = null;
        const current = viewportRef.current;
        if (current) save(currentFocus(current));
      }, SETTLE_MS);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const onWheel = () => {
      pendingTargetRef.current = null;
    };
    viewport.addEventListener("wheel", onWheel, { passive: true });

    const reapply = () => {
      const snapshot = parseSnapshot(history.state?.[HISTORY_KEY]);
      const stations = stationsRef.current;
      const index = snapshot ? stations.findIndex((station) => station.key === snapshot.slug) : -1;
      applyPlan(index === -1 ? 0 : index, index === -1 ? null : snapshot, snapshot?.focus === "link");
    };
    const onPopState = () => {
      if (window.location.pathname === "/portfolio") reapply();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (window.location.pathname !== "/portfolio" || !event.persisted) return;
      reapply();
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);

    const observer = new ResizeObserver(() => {
      if (disposed) return;
      measure();
      if (phaseRef.current === "restoring") return;
      const index = nearest();
      if (index >= 0) applyActive(index);
    });
    observer.observe(viewport);
    const list = viewport.querySelector("ol[data-timeline-list]");
    if (list) observer.observe(list);

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
      if (settleTimer) clearTimeout(settleTimer);
      observer.disconnect();
      cancelRestoreRef.current = () => {};
      root?.removeEventListener("pointerdown", interruptRestore, true);
      root?.removeEventListener("keydown", interruptRestore, true);
      viewport.removeEventListener("wheel", interruptRestore);
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      endDrag();
    };
  }, []);

  const activeStop = stops[activeIndex];
  const caption = captionText(activeStop?.name, activeIndex, stops.length - 1);

  return (
    <PreviewPlaybackScope activeSlug={activeStop?.key ?? null}>
      <div className={styles.timeline} data-active-station={activeStop?.key ?? undefined} data-portfolio-timeline>
        <p className={styles.help} id="portfolio-timeline-help">
          左右滑动或拖动浏览作品，也可使用左右方向键。
        </p>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 滚动地标自带键盘/指针/拖拽交互，聚集后由方向键驱动 */}
        <div
          aria-describedby="portfolio-timeline-help"
          aria-label="作品时间轴"
          className={styles.viewport}
          id="portfolio-timeline"
          ref={viewportRef}
          role="region"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 可滚动地标需可聚焦，方向键才能到达
          tabIndex={0}
          onClickCapture={handleClickCapture}
          onDragStart={(event) => event.preventDefault()}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onLostPointerCapture={() => {
            if (dragRef.current.phase !== "idle") cancelDrag();
          }}
          onPointerCancel={cancelDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
        >
          <ol className={styles.list} data-timeline-list>
            {children}
          </ol>
        </div>
        <footer className={styles.footer}>
          <p className={styles.caption} data-timeline-caption>
            {caption}
          </p>
          <div className={styles.controls}>
            <PlaybackToggle />
            <button
              aria-controls="portfolio-timeline"
              aria-label="向前浏览作品"
              className={styles.step}
              data-direction="previous"
              disabled={bounds.previous}
              onClick={() => handleStepButton(-1)}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.6} />
            </button>
            <button
              aria-controls="portfolio-timeline"
              aria-label="向后浏览作品"
              className={styles.step}
              data-direction="next"
              disabled={bounds.next}
              onClick={() => handleStepButton(1)}
              type="button"
            >
              <ArrowRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </button>
          </div>
        </footer>
        <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {announced}
        </p>
      </div>
    </PreviewPlaybackScope>
  );
}
