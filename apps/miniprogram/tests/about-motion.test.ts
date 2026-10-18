import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as runtime from "../src/lib/runtime";

type SheetPage = {
  data: { careerOpen: boolean; reducedMotion: boolean; careerDuration: number };
  setData(patch: Record<string, unknown>): void;
  toggleCareer(): void; closeCareer(): void; onCareerLeave(): void; onCareerAfterLeave(): void;
  onShow(): void; onHide(): void; onUnload(): void;
  onReducedMotionChange(event: { detail: { value: boolean } }): void;
};
const directory = new URL("../src/pages/about/", import.meta.url);
const template = readFileSync(new URL("index.wxml", directory), "utf8");
const styles = readFileSync(new URL("index.wxss", directory), "utf8");
const bundle = await Bun.build({ entrypoints: [new URL("index.ts", directory).pathname], target: "browser", format: "cjs", external: ["*/lib/runtime"] });
if (!bundle.success) throw new Error(bundle.logs.map(String).join("\n"));
let page: SheetPage;
let originalWx: PropertyDescriptor | undefined;
let stored: boolean;
let tabs: string[];
let motionCallbacks: ((style: { opacity: string }) => void)[];
beforeEach(async () => {
  stored = false; tabs = []; motionCallbacks = [];
  const wxMock = {
    getStorageSync: () => stored,
    setStorageSync: (_key: string, value: boolean) => { stored = value; },
    hideTabBar: () => tabs.push("hide"), showTabBar: () => tabs.push("show"),
    createSelectorQuery() {
      const query = { in: () => query, select: () => query, fields: (_options: unknown, callback: (style: { opacity: string }) => void) => { motionCallbacks.push(callback); return query; }, exec() {} };
      return query;
    },
  };
  originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "wx", { configurable: true, value: wxMock });
  let definition: Record<string, unknown> = {};
  runInNewContext(await bundle.outputs[0].text(), { require: () => runtime, wx: wxMock, Page: (options: Record<string, unknown>) => { definition = options; } });
  page = { ...definition, data: structuredClone(definition.data), setData(this: SheetPage, patch: Record<string, unknown>) { Object.assign(this.data, patch); } } as unknown as SheetPage;
});
afterEach(() => {
  page.onUnload();
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("native career bottom sheet", () => {
  test("opens over the page and restores navigation only after dismissal", () => {
    page.toggleCareer(); expect(page.data.careerOpen).toBe(true); expect(tabs).toEqual(["hide"]);
    page.closeCareer(); expect(page.data.careerOpen).toBe(false); expect(tabs).toEqual(["hide"]);
    page.onCareerAfterLeave(); expect(tabs).toEqual(["hide", "show"]);
  });
  test("native back and overlay closure keep show state synchronized", () => {
    page.toggleCareer(); page.onCareerLeave(); expect(page.data.careerOpen).toBe(false);
    page.onCareerAfterLeave(); expect(tabs.at(-1)).toBe("show");
  });
  test("a stale close completion cannot expose the tab bar behind a reopened sheet", () => {
    page.toggleCareer(); page.closeCareer(); page.toggleCareer(); page.onCareerAfterLeave();
    expect(page.data.careerOpen).toBe(true); expect(tabs).not.toContain("show");
    page.onHide(); expect(page.data.careerOpen).toBe(false); expect(tabs.at(-1)).toBe("show");
  });
  test("unload restores navigation and reduced-motion preference is retained", () => {
    page.onReducedMotionChange({ detail: { value: true } }); page.onShow();
    expect(page.data.reducedMotion).toBe(true);
    page.toggleCareer(); page.onUnload(); expect(tabs.at(-1)).toBe("show");
  });
  test("system preference controls native duration and hidden callbacks are ignored", () => {
    page.onShow(); expect(page.data.careerDuration).toBe(0);
    motionCallbacks[0]!({ opacity: "0" }); expect(page.data.careerDuration).toBe(0);
    page.onShow(); motionCallbacks[1]!({ opacity: "1" }); expect(page.data.careerDuration).toBe(250);
    page.onShow(); page.onHide(); motionCallbacks[2]!({ opacity: "1" }); expect(page.data.careerDuration).toBe(0);
    page.onReducedMotionChange({ detail: { value: true } }); expect(page.data.careerDuration).toBe(0);
  });

  test("native container slides from bottom with a scrollable receipt and explicit close", () => {
    expect(template).toContain('<page-container show="{{careerOpen}}" position="bottom"');
    expect(template).toContain('duration="{{reducedMotion ? 0 : careerDuration}}"');
    expect(template).toContain('close-on-slide-down="{{false}}"');
    expect(template).toContain('bindclickoverlay="closeCareer"');
    expect(template).toContain('bindleave="onCareerLeave"');
    expect(template).toContain('bindafterleave="onCareerAfterLeave"');
    expect(template).toContain('class="career-scroll" scroll-y');
    expect(template).toContain('aria-label="关闭个人经历"');
    expect(template).not.toContain("career-clip"); expect(styles).not.toContain("transition: height");
  });
});
