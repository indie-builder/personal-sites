import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DotFieldRipples, rippleEffect } from "@/components/dot-field-ripples";

const media = vi.hoisted(() => ({
  fine: true,
  reduce: false,
  reduceListeners: [] as Array<() => void>,
  fineListeners: [] as Array<() => void>,
}));

const raf = vi.hoisted(() => ({ cancelCount: 0, frames: [] as Array<(now: number) => void>, id: 0 }));

const observers = vi.hoisted(() => ({
  intersectionDisconnect: vi.fn(),
  resizeCallback: undefined as ResizeObserverCallback | undefined,
  resizeDisconnect: vi.fn(),
}));

class MockIntersectionObserver {
  disconnect = observers.intersectionDisconnect;
  observe = vi.fn();
}

class MockResizeObserver {
  disconnect = observers.resizeDisconnect;
  observe = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    observers.resizeCallback = callback;
  }
}

const ink = vi.hoisted(() => ({ clearRect: vi.fn(), fill: vi.fn() }));

function renderField() {
  const view = render(
    <div className="interactive-dot-field">
      <DotFieldRipples />
    </div>,
  );
  const parent = view.container.firstElementChild as HTMLElement;
  const canvas = parent.querySelector("canvas") as HTMLCanvasElement;
  // jsdom 无布局：挂载时首测尺寸为 0，随后 ResizeObserver 首轮回调带真实尺寸接管。
  Object.defineProperty(parent, "clientHeight", { configurable: true, value: 184 });
  Object.defineProperty(parent, "clientWidth", { configurable: true, value: 400 });
  observers.resizeCallback?.([], {} as ResizeObserver);
  return { canvas, parent };
}

describe("rippleEffect", () => {
  it("returns zero once the ripple outlives its lifetime", () => {
    const ripple = { at: 0, x: 0, y: 0 };
    expect(rippleEffect(ripple, 0, 0, 1_200)).toEqual({ dx: 0, dy: 0, wave: 0 });
    expect(rippleEffect(ripple, 90, 0, 5_000)).toEqual({ dx: 0, dy: 0, wave: 0 });
  });

  it("stays finite at the ripple origin and keeps wave and displacement bounded", () => {
    const ripple = { at: 0, x: 20, y: 10 };
    const origin = rippleEffect(ripple, 20, 10, 10);
    expect(Number.isFinite(origin.dx) && Number.isFinite(origin.dy) && Number.isFinite(origin.wave)).toBe(true);
    expect(origin.dx).toBe(0);
    expect(origin.dy).toBe(0);
    for (let distance = 0; distance <= 300; distance += 3) {
      for (const now of [50, 400, 1_100]) {
        const effect = rippleEffect(ripple, ripple.x + distance, ripple.y, now);
        expect(effect.wave).toBeLessThanOrEqual(1);
        expect(Math.hypot(effect.dx, effect.dy)).toBeLessThanOrEqual(1);
        expect(Number.isFinite(effect.wave)).toBe(true);
      }
    }
  });

  it("displaces dots outward along a ring that keeps expanding with age", () => {
    const ripple = { at: 0, x: 0, y: 0 };
    const peakAt = (now: number) => {
      let peak = { distance: -1, wave: -1 };
      for (let distance = 0; distance <= 300; distance += 1) {
        const wave = rippleEffect(ripple, distance, 0, now).wave;
        if (wave > peak.wave) peak = { distance, wave };
      }
      return peak.distance;
    };
    expect(peakAt(200)).toBeCloseTo(36, 0);
    expect(peakAt(600)).toBeCloseTo(108, 0);
    expect(peakAt(1_000)).toBeCloseTo(180, 0);
    const crest = rippleEffect(ripple, 36, 0, 200);
    expect(crest.dx).toBeGreaterThan(0);
    expect(crest.dy).toBe(0);
  });
});

describe("DotFieldRipples", () => {
  const ctxMock = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: ink.clearRect,
    fill: ink.fill,
    fillStyle: "",
    moveTo: vi.fn(),
    setTransform: vi.fn(),
  };

  beforeEach(() => {
    media.fine = true;
    media.reduce = false;
    media.reduceListeners.length = 0;
    media.fineListeners.length = 0;
    raf.cancelCount = 0;
    raf.frames.length = 0;
    observers.intersectionDisconnect.mockClear();
    observers.resizeCallback = undefined;
    observers.resizeDisconnect.mockClear();
    ink.clearRect.mockClear();
    ink.fill.mockClear();
    // matches 必须是现读：真实 MediaQueryList 的 matches 随偏好变化，组件在
    // 挂载时捕获的对象上读到的也是新值。
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() {
        return query.includes("pointer: fine")
          ? media.fine
          : media.reduce && query.includes("prefers-reduced-motion");
      },
      addEventListener: (_type: string, listener: () => void) => {
        if (query.includes("prefers-reduced-motion")) media.reduceListeners.push(listener);
        if (query.includes("pointer: fine")) media.fineListeners.push(listener);
      },
      removeEventListener: () => {},
    }));
    vi.stubGlobal("requestAnimationFrame", (callback: (now: number) => void) => {
      raf.frames.push(callback);
      return (raf.id += 1);
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      raf.cancelCount += 1;
    });
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctxMock as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("paints the static lattice on ready and settles waves back to an idle stop", () => {
    const { canvas, parent } = renderField();
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");
    expect(ink.fill).toHaveBeenCalled();
    expect(canvas.hasAttribute("data-rippling")).toBe(false);

    fireEvent.pointerMove(parent, { clientX: 120, clientY: 60, pointerType: "mouse" });
    expect(canvas.getAttribute("data-rippling")).toBe("true");
    expect(raf.frames).toHaveLength(1);
    fireEvent.pointerMove(parent, { clientX: 130, clientY: 60, pointerType: "mouse" });
    expect(raf.frames).toHaveLength(1);

    const frame = raf.frames[0]!;
    raf.frames.length = 0;
    frame(performance.now() + 1_300);
    expect(canvas.hasAttribute("data-rippling")).toBe(false);
    expect(raf.frames).toHaveLength(0);
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");
  });

  it("ignores touch pointers and never arms on coarse pointers or reduced motion", () => {
    const { canvas, parent } = renderField();
    fireEvent.pointerMove(parent, { clientX: 120, clientY: 60, pointerType: "touch" });
    expect(raf.frames).toHaveLength(0);
    expect(canvas.hasAttribute("data-rippling")).toBe(false);
    cleanup();

    media.fine = false;
    const coarse = renderField();
    expect(coarse.parent.getAttribute("data-dot-ripples")).toBeNull();
    fireEvent.pointerMove(coarse.parent, { clientX: 120, clientY: 60, pointerType: "mouse" });
    expect(raf.frames).toHaveLength(0);
    const fillsBeforeReduce = ink.fill.mock.calls.length;
    cleanup();

    media.fine = true;
    media.reduce = true;
    const reduced = renderField();
    expect(reduced.parent.getAttribute("data-dot-ripples")).toBeNull();
    expect(ink.fill.mock.calls.length).toBe(fillsBeforeReduce);
  });

  it("restores the CSS static lattice when reduced motion turns on mid-session", () => {
    const { canvas, parent } = renderField();
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");

    media.reduce = true;
    for (const listener of media.reduceListeners) listener();
    expect(parent.getAttribute("data-dot-ripples")).toBeNull();
    expect(canvas.hasAttribute("data-rippling")).toBe(false);
    expect(ink.clearRect).toHaveBeenCalled();

    media.reduce = false;
    for (const listener of media.reduceListeners) listener();
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");
    expect(canvas.hasAttribute("data-rippling")).toBe(false);
  });

  it("can enable after an initially reduced session and follows pointer capability changes", () => {
    media.reduce = true;
    const { parent } = renderField();
    expect(parent.hasAttribute("data-dot-ripples")).toBe(false);
    media.reduce = false;
    for (const listener of media.reduceListeners) listener();
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");
    media.fine = false;
    for (const listener of media.fineListeners) listener();
    expect(parent.hasAttribute("data-dot-ripples")).toBe(false);
    media.fine = true;
    for (const listener of media.fineListeners) listener();
    expect(parent.getAttribute("data-dot-ripples")).toBe("ready");
  });

  it("does not repaint a second grid when visibility changes after reduced motion disables canvas", () => {
    const { parent } = renderField();
    media.reduce = true;
    for (const listener of media.reduceListeners) listener();
    const before = ink.fill.mock.calls.length;
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ink.fill).toHaveBeenCalledTimes(before);
    expect(parent.hasAttribute("data-dot-ripples")).toBe(false);
  });

  it("stops waves and drops the takeover marker on unmount", () => {
    const { canvas, parent } = renderField();
    fireEvent.pointerMove(parent, { clientX: 120, clientY: 60, pointerType: "mouse" });
    expect(canvas.getAttribute("data-rippling")).toBe("true");

    cleanup();
    expect(parent.getAttribute("data-dot-ripples")).toBeNull();
    expect(observers.intersectionDisconnect).toHaveBeenCalled();
    expect(observers.resizeDisconnect).toHaveBeenCalled();
  });
});
