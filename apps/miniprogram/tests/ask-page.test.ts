import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import * as runtime from "../src/lib/runtime";
import type { AskSource, AskState } from "../src/lib/runtime";

type MessageView = AskState["messages"][number] & {
  parts: ReturnType<typeof runtime.markdownParts>;
  sourceViews: { number: number; index: number; title: string; meta: string }[];
  sourceCount: number;
};
type Data = {
  draft: string; messages: MessageView[]; streaming: boolean; error: string;
  pageError: string; canSend: boolean; hasConversation: boolean; inputFocused: boolean;
  showLatest: boolean; scrollTarget: string; screenHeight: number; keyboardOpen: boolean;
  scopeIndex: number; scopeLabel: string; inputHint: string;
  inputHeight: number; hiddenCount: number;
};
type Tap = { currentTarget: { dataset: { messageId?: string; index?: number } } };
type TestPage = {
  data: Data;
  controller: ReturnType<typeof runtime.createAsk>;
  cancel?: () => void;
  visible: boolean;
  followLatest: boolean;
  viewportHeight: number;
  windowEnd: number;
  setData(patch: Partial<Data>, callback?: () => void): void;
  onLoad(): void; onReady(): void; onShow(): void; onHide(): void; onUnload(): void;
  onInput(event: { detail: { value: string } }): void;
  onLineChange(event: { detail: { lineCount?: number; height?: number } }): void;
  onScopeChange(event: { detail: { value: string } }): void;
  onExample(event: Tap): void;
  loadEarlier(): void;
  send(): void; stop(): void; retry(): void; newConversation(): void;
  copyAnswer(event: Tap): void; openSource(event: Tap): void;
  onScroll(event: { detail: { scrollTop: number; scrollHeight: number } }): void;
  returnLatest(): void;
  onKeyboardHeight(event: { detail: { height: number } }): void;
  onResize(): void;
};

let definition: Record<string, unknown> = {};
const build = await Bun.build({
  entrypoints: [new URL("../src/pages/ask/index.ts", import.meta.url).pathname],
  target: "browser", format: "cjs", external: ["*/lib/runtime"],
});
if (!build.success) throw new Error(build.logs.map(String).join("\n"));
// Count real Markdown parses through the exact runtime object the page imports.
const runtimeSpy = { ...runtime, markdownParts: (...args: Parameters<typeof runtime.markdownParts>) => { parseCount++; return runtime.markdownParts(...args); } };
let page: TestPage;
let request: Parameters<typeof wx.request>[0] | undefined;
let chunk: ((event: { data: ArrayBuffer }) => void) | undefined;
let headers: ((event: { statusCode: number }) => void) | undefined;
let aborted = 0;
let copies: string[] = [];
let toasts: string[] = [];
let modal: { success: (result: { confirm: boolean }) => void } | undefined;
let citation: AskSource | undefined;
let destination = "";
let patches: { keys: string[]; bytes: number }[] = [];
let parseCount = 0;
let originalWx: PropertyDescriptor | undefined;
let windowInfo = { windowHeight: 700, screenHeight: 844, screenTop: 60 };
afterEach(() => {
  page?.onUnload();
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

function fakeWx() {
  return {
    getWindowInfo: () => windowInfo,
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
    getStorageSync: () => "a".repeat(32),
    setStorageSync() {},
    request(options: Parameters<typeof wx.request>[0]) {
      request = options;
      return {
        onChunkReceived(callback: typeof chunk) { chunk = callback; },
        onHeadersReceived(callback: typeof headers) { headers = callback; },
        offChunkReceived() {}, offHeadersReceived() {},
        abort() { aborted++; },
      };
    },
    setClipboardData(options: { data: string; success: () => void }) { copies.push(options.data); options.success(); },
    showToast(options: { title: string }) { toasts.push(options.title); },
    showModal(options: typeof modal) { modal = options; },
    navigateTo(options: { url: string; success: (result: { eventChannel: { emit: (name: string, source: AskSource) => void } }) => void }) {
      destination = options.url;
      options.success({ eventChannel: { emit: (_name, source) => { citation = source; } } });
    },
  };
}

function push(event: string, data: unknown) {
  headers?.({ statusCode: 200 });
  const bytes = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  chunk?.({ data: bytes.buffer });
}

async function settle() { await new Promise<void>((resolve) => setImmediate(resolve)); }
const input = (value: string) => page.onInput({ detail: { value } });
const tap = (messageId?: string, index?: number): Tap => ({ currentTarget: { dataset: { messageId, index } } });
const source = (title: string): AskSource => ({ id: "duplicate", title, content: "本次检索公开片段", sourceUrl: "https://example.com/source", scope: "profile" });

beforeEach(async () => {
  request = undefined; chunk = undefined; headers = undefined; aborted = 0;
  windowInfo = { windowHeight: 700, screenHeight: 844, screenTop: 60 };
  copies = []; toasts = []; modal = undefined; citation = undefined; destination = ""; patches = []; parseCount = 0;
  const wxMock = fakeWx();
  originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "wx", { configurable: true, value: wxMock });
  runInNewContext(await build.outputs[0].text(), {
    require: () => runtimeSpy,
    Page: (options: Record<string, unknown>) => { definition = options; },
    wx: wxMock,
  });
  page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(this: TestPage, patch: Partial<Data>, callback?: () => void) {
      const keys = Object.keys(patch);
      patches.push({ keys, bytes: new TextEncoder().encode(JSON.stringify(patch)).byteLength });
      // Mirrors native dotted setData: "messages[2].text" patches one field, not the array.
      for (const key of keys) {
        const path = /^(\w+)\[(\d+)\](?:\.(\w+))?$/.exec(key);
        const value = (patch as Record<string, unknown>)[key];
        if (path) {
          const list = this.data[path[1] as keyof Data] as unknown as Record<string, unknown>[];
          if (path[3]) (list[Number(path[2])] as Record<string, unknown>)[path[3]] = value;
          else if (value && typeof value === "object") list[Number(path[2])] = value as Record<string, unknown>;
        } else (this.data as unknown as Record<string, unknown>)[key] = value;
      }
      callback?.();
    },
  } as unknown as TestPage;
  page.onLoad(); page.onReady();
});

describe("native Ask page boundary", () => {
  test("validates composer, selects example scope and keeps a draft through tab changes", () => {
    input(" 陈 "); expect(page.data.canSend).toBe(false); expect(page.data.inputHint).toBe("至少输入 2 个字");
    input("问".repeat(1001)); expect(page.data.canSend).toBe(false);
    page.send(); expect(request).toBeUndefined();
    page.onExample(tap(undefined, 1));
    expect(page.controller.state.scope).toBe("ai-news");
    expect(page.data.draft).toBe("最近关注哪些 AI 技术？");
    page.onHide(); page.onShow();
    expect(page.data.draft).toBe("最近关注哪些 AI 技术？");
    expect(page.data.canSend).toBe(true);
  });

  test("onHide aborts a real active request and retains partial answer plus a new draft", async () => {
    input("介绍一下陈远"); page.send(); await settle();
    expect(request?.enableChunked).toBe(true);
    push("text", { delta: "这是已有的回答。" });
    input("保留这条追问");
    page.onHide(); await settle();
    expect(aborted).toBeGreaterThan(0);
    expect(page.controller.state.streaming).toBe(false);
    expect(page.controller.state.messages.at(-1)?.status).toBe("stopped");
    push("text", { delta: "迟到的片段" });
    page.onShow();
    expect(page.data.messages.at(-1)?.text).toBe("这是已有的回答。");
    expect(page.data.draft).toBe("保留这条追问");
  });

  test("late citations keep source order including duplicate IDs, native reader and copy", async () => {
    input("引用怎么阅读"); page.send(); await settle();
    push("text", { delta: "**安全回答**【1】【2】<script>bad()</script>" });
    push("sources", { sources: [source("第一篇"), source("第二篇")] });
    push("done", {}); await settle();
    const answer = page.data.messages.at(-1)!;
    expect(answer.sourceViews.map((item) => [item.number, item.title])).toEqual([[1, "第一篇"], [2, "第二篇"]]);
    expect(JSON.stringify(answer.parts)).not.toContain('"name":"script"');
    expect(answer.sourceViews.every((view) => !("content" in view))).toBe(true);
    expect(JSON.stringify(answer.parts)).not.toContain("本次检索公开片段");
    page.openSource(tap(answer.id, 1));
    expect(destination).toBe("/pages/detail/index?citation=1");
    expect(citation?.title).toBe("第二篇");
    page.copyAnswer(tap(answer.id));
    expect(copies).toEqual([answer.text]); expect(toasts).toContain("回答已复制");
  });

  test("stream errors are visible and retry uses the original question scope", async () => {
    page.onScopeChange({ detail: { value: "1" } });
    input("介绍一下陈远"); page.send(); await settle();
    push("error", { message: "稍后再试" }); await settle();
    expect(page.data.error).toBe("稍后再试");
    expect(page.data.messages.at(-1)?.status).toBe("error");
    page.onScopeChange({ detail: { value: "2" } });
    page.retry(); await settle();
    expect(request?.data).toMatchObject({ question: "介绍一下陈远", scope: "profile" });
    page.stop();
  });

  test("new dialog only clears state after confirmation", () => {
    input("待发送的草稿"); page.newConversation();
    modal?.success({ confirm: false }); expect(page.data.draft).toBe("待发送的草稿");
    page.newConversation(); modal?.success({ confirm: true });
    expect(page.data.draft).toBe(""); expect(page.data.messages).toEqual([]);
  });

  test("new chunks do not pull a reader from older text; return latest restores follow", async () => {
    input("阅读一个长答案"); page.send(); await settle();
    push("text", { delta: "第一段" });
    page.onScroll({ detail: { scrollTop: 600, scrollHeight: 1000 } });
    page.onScroll({ detail: { scrollTop: 600, scrollHeight: 1600 } });
    expect(page.followLatest).toBe(true);
    page.onScroll({ detail: { scrollTop: 0, scrollHeight: 1600 } });
    expect(page.data.showLatest).toBe(true);
    const previous = page.data.scrollTarget;
    push("text", { delta: "第二段" });
    expect(page.data.scrollTarget).toBe(previous);
    page.returnLatest(); expect(page.data.showLatest).toBe(false);
    expect(page.data.scrollTarget).not.toBe(previous);
    page.onScroll({ detail: { scrollTop: 550, scrollHeight: 1000 } });
    expect(page.followLatest).toBe(true);
    page.stop();
  });

  test("landscape resize retains the draft and recalculates keyboard coverage", () => {
    input("横屏继续提问");
    windowInfo = { windowHeight: 280, screenHeight: 390, screenTop: 60 };
    page.onResize();
    expect(page.data.screenHeight).toBe(280);
    expect(page.data.draft).toBe("横屏继续提问");
    page.onKeyboardHeight({ detail: { height: 180 } });
    expect(page.data.screenHeight).toBe(150);
    expect(page.data.keyboardOpen).toBe(true);
    page.onKeyboardHeight({ detail: { height: 0 } });
    expect(page.data.screenHeight).toBe(280);
  });

  test("keyboard subtracts only the covered content region above the native tab safe area", () => {
    expect(page.data.screenHeight).toBe(700);
    page.onKeyboardHeight({ detail: { height: 300 } });
    expect(page.data.screenHeight).toBe(484);
    expect(page.data.keyboardOpen).toBe(true);
    page.onKeyboardHeight({ detail: { height: 0 } });
    expect(page.data.screenHeight).toBe(700);
  });

  test("composer height follows native line-change events and caps at six lines", () => {
    expect(page.data.inputHeight).toBe(48);
    page.onLineChange({ detail: { lineCount: 1, height: 26 } });
    expect(page.data.inputHeight).toBe(34);
    page.onLineChange({ detail: { lineCount: 3, height: 78 } });
    expect(page.data.inputHeight).toBe(86);
    page.onLineChange({ detail: { lineCount: 6, height: 156 } });
    expect(page.data.inputHeight).toBe(164);
    page.onLineChange({ detail: { lineCount: 9, height: 234 } });
    expect(page.data.inputHeight).toBe(164);
    page.onKeyboardHeight({ detail: { height: 300 } });
    expect(page.data.screenHeight).toBe(484);
    expect(page.data.inputHeight).toBe(164);
    page.onLineChange({ detail: {} });
    expect(page.data.inputHeight).toBe(164);
  });

  test("streamed deltas patch only the changed answer path, never full history", async () => {
    input("介绍一个长回答"); page.send(); await settle();
    const answerIndex = page.data.messages.length - 1;
    patches = []; parseCount = 0;
    for (const delta of ["第一段。", "第二段。", "第三段。", "第四段。"]) { push("text", { delta }); await settle(); }
    const answerPatches = patches.flatMap((patch) => patch.keys).filter((key) => key.startsWith("messages"));
    expect(answerPatches).toEqual([
      `messages[${answerIndex}].text`, `messages[${answerIndex}].parts`,
      `messages[${answerIndex}].text`, `messages[${answerIndex}].parts`,
      `messages[${answerIndex}].text`, `messages[${answerIndex}].parts`,
      `messages[${answerIndex}].text`, `messages[${answerIndex}].parts`,
    ]);
    expect(patches.flatMap((patch) => patch.keys)).not.toContain("messages");
    expect(patches.every((patch) => patch.bytes < 1024)).toBe(true);
    // Unchanged messages are not re-parsed; only the streaming answer is.
    expect(parseCount).toBe(4);
    push("done", {}); await settle();
    page.loadEarlier();
    expect(parseCount).toBe(4);
  });

  test("long answers, twelve rounds and six large sources keep every patch under 1 MiB and all older messages reachable", async () => {
    const answers: string[] = [];
    for (let round = 0; round < 12; round++) {
      input(`第 ${round + 1} 个问题，考察长上下文`); page.send(); await settle();
      const sources = Array.from({ length: 6 }, (_, index) => ({
        id: `source-${round}-${index}`, title: `来源 ${index + 1}`, content: "检索原文".repeat(2000),
        sourceUrl: "https://example.com/source", scope: "open-source", section: "open-source",
      }));
      push("sources", { sources }); await settle();
      const answer = "回答内容很长【1】【2】【3】【4】【5】【6】。".repeat(250).slice(0, 3000);
      answers.push(answer);
      for (let offset = 0; offset < answer.length; offset += 60) {
        patches = [];
        push("text", { delta: answer.slice(offset, offset + 60) }); await settle();
        expect(Math.max(0, ...patches.map((patch) => patch.bytes))).toBeLessThan(1024 * 1024);
      }
      push("done", {}); await settle();
      expect(page.data.messages.at(-1)?.status).toBe("complete");
    }
    expect(page.controller.state.messages).toHaveLength(24);
    expect(page.data.messages.length).toBeLessThanOrEqual(20);
    expect(page.data.messages.at(-1)?.id).toBe(page.controller.state.messages.at(-1)?.id);
    expect(page.data.hiddenCount).toBeGreaterThan(0);
    expect(JSON.stringify(page.data.messages)).not.toContain("检索原文");

    // Load older pages until the controller's very first message is visible; every patch stays bounded.
    let rounds = 0;
    while (page.data.hiddenCount > 0) {
      patches = [];
      page.loadEarlier();
      expect(Math.max(0, ...patches.map((patch) => patch.bytes))).toBeLessThan(1024 * 1024);
      expect(page.data.messages.length).toBeLessThanOrEqual(20);
      expect(++rounds).toBeLessThan(24);
    }
    expect(page.data.messages[0]?.id).toBe(page.controller.state.messages[0]?.id);
    expect(page.data.showLatest).toBe(true);

    page.returnLatest();
    expect(page.data.showLatest).toBe(false);
    expect(page.data.messages.at(-1)?.id).toBe(page.controller.state.messages.at(-1)?.id);
    expect(page.data.hiddenCount).toBeGreaterThan(0);
  });

  test("citation-dense answers page by byte budget without oversized patches or source content", async () => {
    for (let round = 0; round < 12; round++) {
      input(`第 ${round + 1} 个问题`); page.send(); await settle();
      push("sources", { sources: [source(`引用 ${round + 1}`)] }); await settle();
      const answer = "字【1】".repeat(1000);
      for (let offset = 0; offset < answer.length; offset += 200) {
        patches = [];
        push("text", { delta: answer.slice(offset, offset + 200) }); await settle();
        expect(Math.max(0, ...patches.map((patch) => patch.bytes))).toBeLessThan(1024 * 1024);
      }
      push("done", {}); await settle();
    }
    const density = JSON.stringify(page.data.messages);
    expect(patches.every((patch) => patch.bytes < 1024 * 1024)).toBe(true);
    expect(density).not.toContain("本次检索公开片段");
    expect(page.data.messages.at(-1)?.parts.some((part) => part.kind === "flow" && part.runs.some((run) => "ref" in run))).toBe(true);

    while (page.data.hiddenCount > 0) {
      patches = [];
      page.loadEarlier();
      expect(Math.max(0, ...patches.map((patch) => patch.bytes))).toBeLessThan(1024 * 1024);
      expect(JSON.stringify(page.data.messages)).not.toContain("本次检索公开片段");
    }
    expect(page.data.messages[0]?.id).toBe(page.controller.state.messages[0]?.id);
  });
});
