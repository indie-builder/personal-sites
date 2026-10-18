import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as runtime from "../src/lib/runtime";

type Rect = { height: number } | null;
type Page = {
  data: {
    careerOpen: boolean;
    careerHeight: string;
    reducedMotion: boolean;
    profile: { name: string };
    career: { company: string }[];
  };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  measureCareer(): void;
  toggleCareer(): void;
  onShow(): void;
  onResize(): void;
  onHide(): void;
  onUnload(): void;
  onReducedMotionChange(event: { detail: { value: boolean } }): void;
};

const source = new URL("../src/pages/about/", import.meta.url);
const template = readFileSync(new URL("index.wxml", source), "utf8");
const styles = readFileSync(new URL("index.wxss", source), "utf8");
const build = await Bun.build({
  entrypoints: [new URL("index.ts", source).pathname],
  target: "browser", format: "cjs", external: ["*/lib/runtime"],
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));

let page: Page;
let callbacks: ((rect: Rect) => void)[];
let executed: number;
let throwQuery: boolean;
let storedMotion: boolean;
let writes: [string, unknown][];
let originalWx: PropertyDescriptor | undefined;

function fakeWx() {
  return {
    createSelectorQuery() {
      if (throwQuery) throw new Error("selector query unavailable");
      const query = {
        in: () => query,
        select: () => query,
        boundingClientRect: (callback: (rect: Rect) => void) => { callbacks.push(callback); return query; },
        exec: () => { executed += 1; },
      };
      return query;
    },
    getStorageSync(key: string) { return key === "chenyuan.reduced-motion" ? storedMotion : undefined; },
    setStorageSync(key: string, value: unknown) { writes.push([key, value]); },
    showToast() {},
    setClipboardData() {},
  };
}

beforeEach(async () => {
  callbacks = []; executed = 0; throwQuery = false; storedMotion = true; writes = [];
  const wxMock = fakeWx();
  originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "wx", { configurable: true, value: wxMock });
  let definition: Record<string, unknown> = {};
  runInNewContext(await build.outputs[0].text(), {
    require: () => runtime,
    Page: (options: Record<string, unknown>) => { definition = options; },
    wx: wxMock,
  });
  page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(this: Page, patch: Record<string, unknown>, callback?: () => void) {
      for (const [key, value] of Object.entries(patch)) (this.data as Record<string, unknown>)[key] = value;
      callback?.();
    },
  } as unknown as Page;
});

afterEach(() => {
  page?.onUnload();
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("About native career motion", () => {
  test("rapid toggles retarget state and only the latest measurement applies", () => {
    page.toggleCareer();
    expect(page.data.careerOpen).toBe(true);
    expect(executed).toBe(1);
    page.toggleCareer();
    expect(page.data.careerOpen).toBe(false);
    expect(page.data.careerHeight).toBe("0px");
    page.toggleCareer();
    expect(page.data.careerOpen).toBe(true);
    expect(callbacks).toHaveLength(2);
    callbacks[0]!({ height: 999 });
    expect(page.data.careerHeight).toBe("0px");
    callbacks[1]!({ height: 412.4 });
    expect(page.data.careerHeight).toBe("413px");
  });

  test("closing after an open settles leaves no stale command behind", () => {
    page.toggleCareer();
    callbacks[0]!({ height: 400 });
    expect(page.data.careerHeight).toBe("400px");
    page.toggleCareer();
    expect(page.data.careerHeight).toBe("0px");
    page.onShow();
    expect(callbacks).toHaveLength(1);
    page.onResize();
    expect(executed).toBe(1);
  });

  test("measurement failures keep the open receipt readable", () => {
    page.toggleCareer();
    callbacks[0]!(null);
    expect(page.data.careerHeight).toBe("auto");
    page.toggleCareer();
    expect(page.data.careerHeight).toBe("0px");
    throwQuery = true;
    page.toggleCareer();
    expect(page.data.careerHeight).toBe("auto");
    expect(page.data.careerOpen).toBe(true);
  });

  test("hide and unload invalidate deferred measurements", () => {
    page.toggleCareer();
    page.onHide();
    callbacks[0]!({ height: 500 });
    expect(page.data.careerHeight).toBe("0px");
    // onHide keeps the open state; the next toggle closes, then a fresh open measures again.
    page.toggleCareer();
    page.toggleCareer();
    expect(callbacks).toHaveLength(2);
    page.onUnload();
    callbacks[1]!({ height: 600 });
    expect(page.data.careerHeight).toBe("0px");
  });

  test("resize remeasures the open receipt and reduced motion re-reads the stored preference", () => {
    page.onResize();
    expect(callbacks).toHaveLength(0);
    page.toggleCareer();
    page.onResize();
    expect(callbacks).toHaveLength(2);
    callbacks[1]!({ height: 360 });
    expect(page.data.careerHeight).toBe("360px");
    expect(page.data.reducedMotion).toBe(false);
    page.onShow();
    expect(page.data.reducedMotion).toBe(true);
    page.onReducedMotionChange({ detail: { value: true } });
    expect(writes).toEqual([["chenyuan.reduced-motion", true]]);
    expect(page.data.reducedMotion).toBe(true);
  });

  test("template and styles declare a persistent, measure-driven accordion", () => {
    expect(template).toContain("about-page {{reducedMotion ? 'motion-reduced' : ''}}");
    // The receipt stays mounted so its height is measured once and closed content keeps no hit target.
    expect(template).not.toMatch(/career-receipt[^>]*wx:if/);
    expect(template).toContain('id="career-receipt"');
    expect(template).toContain('aria-hidden="{{careerOpen ? \'false\' : \'true\'}}"');
    expect(template).toContain('bindchange="onReducedMotionChange"');
    expect(template).toContain("career-chevron {{careerOpen ? 'is-open' : ''}}");
    expect(styles).toMatch(/\.career-clip[^}]*height 200ms var\(--ease-out\), opacity 160ms var\(--ease-out\)/);
    expect(styles).toMatch(/\.career-chevron[^}]*transform 160ms var\(--ease-out\)/);
    // The curve is the shared app token; the page must not fork its own easing system.
    expect(styles).not.toMatch(/cubic-bezier/);
    expect(styles).not.toMatch(/bounce|spring|overshoot/i);
  });
});
