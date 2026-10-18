import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as runtime from "../src/lib/runtime";
import type { AskState } from "../src/lib/runtime";

type Data = { streaming: boolean; canSend: boolean; draft: string; reducedMotion: boolean; messages: AskState["messages"] };
type TestPage = {
  data: Data;
  controller: ReturnType<typeof runtime.createAsk>;
  visible: boolean;
  setData(patch: Record<string, unknown>): void;
  onLoad(): void; onShow(): void; onHide(): void; onUnload(): void;
  onInput(event: { detail: { value: string } }): void;
  handleSubmit(): void; send(): void; stop(): void;
};

const source = new URL("../src/pages/ask/", import.meta.url);
const template = readFileSync(new URL("index.wxml", source), "utf8");
const styles = readFileSync(new URL("index.wxss", source), "utf8");
const build = await Bun.build({
  entrypoints: [new URL("index.ts", source).pathname],
  target: "browser", format: "cjs", external: ["*/lib/runtime"],
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));

let page: TestPage;
let originalWx: PropertyDescriptor | undefined;
const reads: unknown[] = [];
const requests: unknown[] = [];

function fakeWx() {
  return {
    getWindowInfo: () => ({ windowHeight: 700, screenHeight: 844, screenTop: 60 }),
    hideKeyboard() {},
    createSelectorQuery() {
      const query = {
        in: () => query,
        select: () => query,
        boundingClientRect: (callback: (rect: { height: number }) => void) => { callback({ height: 400 }); return query; },
        exec() {},
      };
      return query;
    },
    getStorageSync(key: string) { reads.push(key); return key === "chenyuan.reduced-motion" ? storedMotion : "a".repeat(32); },
    setStorageSync() {},
    request(options: unknown) { requests.push(options); return { onChunkReceived() {}, onHeadersReceived() {}, offChunkReceived() {}, offHeadersReceived() {}, abort() {} }; },
  };
}

let storedMotion: unknown = true;

beforeEach(async () => {
  reads.length = 0; requests.length = 0; storedMotion = true;
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
    setData(this: TestPage, patch: Record<string, unknown>) { Object.assign(this.data, patch); },
  } as unknown as TestPage;
  page.onLoad();
});

afterEach(() => {
  page?.onUnload();
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("Ask native motion", () => {
  test("the persistent submit control sends when idle and stops while streaming", async () => {
    page.onInput({ detail: { value: "介绍一下陈远" } });
    expect(page.data.canSend).toBe(true);
    page.handleSubmit();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(requests).toHaveLength(1);
    expect(page.data.streaming).toBe(true);
    page.handleSubmit();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(page.data.streaming).toBe(false);
    expect(page.controller.state.messages.at(-1)?.status).toBe("stopped");
  });

  test("stop still works when the draft cannot be sent", async () => {
    page.onInput({ detail: { value: "介绍一下陈远" } });
    page.handleSubmit();
    await new Promise<void>((resolve) => setImmediate(resolve));
    page.onInput({ detail: { value: "" } });
    expect(page.data.canSend).toBe(false);
    page.handleSubmit();
    expect(page.data.streaming).toBe(false);
    expect(page.controller.state.messages.at(-1)?.status).toBe("stopped");
  });

  test("one submit button owns both actions with dynamic labels and no separate conditional handlers", () => {
    expect(template).not.toMatch(/wx:if="\{\{streaming\}\}"[^>]*ask-submit/);
    expect(template).not.toMatch(/wx:else class="ask-submit"/);
    expect(template).toMatch(/class="ask-submit motion-control" hover-class="motion-press" disabled="\{\{!streaming && !canSend\}\}" bindtap="handleSubmit"/);
    expect(template).toContain("aria-label=\"{{streaming ? '停止生成回答' : '发送问题'}}\"");
    expect(template).toContain("ask-send-arrow");
    expect(template).toContain("ask-stop-square");
    // Icon layers are decorative; no streamed text or scrolling is animated.
    expect(template.match(/class="ask-submit-icon/g)).toHaveLength(2);
    expect(template).not.toMatch(/message\.text[^>]*motion/);
  });

  test("icon crossfade and press feedback are bounded, and reduced motion keeps the final state", () => {
    expect(styles).toMatch(/\.ask-submit-icon[^}]*opacity 120ms var\(--ease-out\)/);
    expect(styles).toMatch(/\.ask-submit-icon\.is-hidden[^}]*translateY\(2px\) scale\(\.95\)/);
    expect(styles).toMatch(/\.ask-stop-square[^}]*border-radius: 2px/);
    expect(template).toContain('class="ask-sources"');
    expect(styles).not.toContain("ask-source-enter");
    expect(styles).toMatch(/\.motion-reduced \.ask-submit-icon[^}]*transition: none/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.ask-submit-icon \{ transition: none; transform: none; \}/);
    expect(styles).not.toMatch(/@keyframes[^{]*\{[^@}]*(width|height|margin|padding|top|left)\s*:/);
  });

  test("reduced motion is re-read on show and stored in a root class", () => {
    expect(template).toContain("class=\"ask {{reducedMotion ? 'motion-reduced' : ''}}\"");
    expect(page.data.reducedMotion).toBe(false);
    page.onShow();
    expect(page.data.reducedMotion).toBe(true);
    storedMotion = "";
    page.onHide(); page.onShow();
    expect(page.data.reducedMotion).toBe(false);
    storedMotion = true;
    page.onShow();
    expect(page.data.reducedMotion).toBe(true);
    // The preference is read through the same native helper used elsewhere.
    expect(reads.filter((key) => key === "chenyuan.reduced-motion").length).toBeGreaterThanOrEqual(3);
  });
});
