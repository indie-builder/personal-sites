import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { root, routes } from "./package";

const site = "https://default-coder.lovemyrmb.cn";
const portfolio = "https://portfolio.default-coder.lovemyrmb.cn";
const forbiddenGlobals = ["fetch", "URL", "TextEncoder", "TextDecoder", "AbortController"];
// WeChat rejects a single setData payload above 1 MiB; every call in this harness is measured against it.
export const setDataLimit = 1024 * 1024;

type Callback = (...args: any[]) => void;
type Options = Record<string, any>;
type PageInstance = Options & { data: Options; setData: (patch: Options, callback?: Callback) => void };
type Request = {
  options: Options; aborted: boolean; settled: boolean; chunks: Callback[]; headers: Callback[]; abort: () => void;
};

// shortcut: models the documented AppService APIs, not WXML layout or a WeChat simulator; use DevTools/device verification for those.
export function createAppService(directory = path.join(root, "dist")) {
  const definitions = new Map<string, Options>();
  const modules = new Map<string, { exports: any }>();
  const loads = new Map<string, number>();
  const requests: Request[] = [];
  const storage = new Map<string, unknown>();
  const clipboard: string[] = [];
  const previews: Options[] = [];
  const toasts: string[] = [];
  const patches: { route: string; keys: string[]; bytes: number }[] = [];
  const scrolls: number[] = [];
  const stack: PageInstance[] = [];
  const tabRoutes = new Set<string>(JSON.parse(readFileSync(path.join(directory, "app.json"), "utf8")).tabBar.list.map((tab: { pagePath: string }) => tab.pagePath));
  const tabs = new Map<string, PageInstance>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let registering = "";
  let app: Options = {};
  let pullDownStops = 0;
  let random = 0;
  let modalConfirm = true;

  function channel() {
    const listeners = new Map<string, Callback[]>();
    const queued = new Map<string, unknown[][]>();
    return {
      on(name: string, callback: Callback) {
        listeners.set(name, [...(listeners.get(name) ?? []), callback]);
        for (const args of queued.get(name) ?? []) callback(...args);
        queued.delete(name);
      },
      off(name: string, callback?: Callback) {
        listeners.set(name, callback ? (listeners.get(name) ?? []).filter((item) => item !== callback) : []);
      },
      emit(name: string, ...args: unknown[]) {
        const callbacks = listeners.get(name) ?? [];
        if (!callbacks.length) queued.set(name, [...(queued.get(name) ?? []), args]);
        for (const callback of callbacks) callback(...args);
      },
    };
  }

  function open(url: string, options: Options = {}) {
    const [route, search = ""] = url.replace(/^\//, "").split("?");
    const definition = definitions.get(route);
    assert(definition, `unregistered page ${route}`);
    const eventChannel = channel();
    for (const [name, callback] of Object.entries(options.events ?? {})) eventChannel.on(name, callback as Callback);
    const page: PageInstance = {
      ...definition,
      route,
      data: JSON.parse(JSON.stringify(definition.data ?? {})),
      getOpenerEventChannel: () => eventChannel,
      setData(patch, callback) {
        const bytes = Buffer.byteLength(JSON.stringify(patch));
        assert(bytes <= setDataLimit, `setData on ${route} sent ${bytes} bytes; WeChat rejects payloads over 1 MiB`);
        patches.push({ route, keys: Object.keys(patch), bytes });
        for (const [key, value] of Object.entries(patch)) {
          // Native setData accepts dotted and indexed paths and serializable values only.
          assert(value !== undefined, `setData(${key}) received undefined`);
          const parts = key.replace(/\[(\d+)\]/g, ".$1").split(".");
          let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part] ??= {};
          target[parts.at(-1)!] = JSON.parse(JSON.stringify(value));
        }
        callback?.();
      },
    };
    if (tabRoutes.has(route)) assert(!tabs.has(route), `tab ${route} already exists; use switchTab to revisit it`);
    stack.at(-1)?.onHide?.();
    stack.push(page);
    if (tabRoutes.has(route)) tabs.set(route, page);
    const query = Object.fromEntries(search.split("&").filter(Boolean).map((part) => {
      const [key, ...value] = part.split("=");
      return [decodeURIComponent(key), decodeURIComponent(value.join("="))];
    }));
    page.onLoad?.(query);
    options.success?.({ eventChannel });
    page.onShow?.();
    page.onReady?.();
    return page;
  }

  const wx = {
    request(options: Options) {
      assert([site, portfolio].some((origin) => options.url.startsWith(`${origin}/api/`)), `non-public request: ${options.url}`);
      assert(!Object.keys(options.header ?? {}).some((name) => /authorization|cookie|api-key/i.test(name)), "public requests must not send credentials");
      const request: Request = {
        options, aborted: false, settled: false, chunks: [], headers: [],
        abort() {
          if (this.aborted || this.settled) return;
          this.aborted = true;
          options.fail?.({ errMsg: "request:fail abort" });
          options.complete?.({ errMsg: "request:fail abort" });
        },
      };
      requests.push(request);
      return {
        abort: () => request.abort(),
        onChunkReceived: (callback: Callback) => request.chunks.push(callback),
        offChunkReceived: (callback?: Callback) => { request.chunks = callback ? request.chunks.filter((item) => item !== callback) : []; },
        onHeadersReceived: (callback: Callback) => request.headers.push(callback),
        offHeadersReceived: () => { request.headers = []; },
      };
    },
    navigateTo: (options: Options) => open(options.url, options),
    navigateBack() {
      assert(stack.length > 1, "no page to return to");
      stack.pop()?.onUnload?.();
      stack.at(-1)?.onShow?.();
    },
    switchTab(options: Options) {
      const route = options.url.replace(/^\//, "");
      assert(tabRoutes.has(route), `switchTab requires a declared tab: ${route}`);
      stack.at(-1)?.onHide?.();
      while (stack.length) {
        const page = stack.pop()!;
        if (!tabRoutes.has(page.route)) page.onUnload?.();
      }
      const cached = tabs.get(route);
      if (!cached) return open(options.url, options);
      stack.push(cached);
      options.success?.({});
      cached.onShow?.();
      return cached;
    },
    setNavigationBarTitle() {},
    hideTabBar() {},
    showTabBar() {},
    stopPullDownRefresh() { pullDownStops++; },
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    getRandomValues(options: Options) {
      const bytes = new Uint8Array(options.length ?? 16).fill(++random);
      const result = { randomValues: bytes.buffer };
      options.success?.(result);
      return result;
    },
    showToast: (options: Options) => toasts.push(options.title),
    showModal: (options: Options) => options.success?.({ confirm: modalConfirm, cancel: !modalConfirm }),
    setClipboardData(options: Options) { clipboard.push(options.data); options.success?.({}); },
    previewImage: (options: Options) => previews.push(options),
    hideKeyboard() {},
    createVideoContext: () => ({ pause() {} }),
    createSelectorQuery() {
      let measured: Callback | undefined;
      const query = {
        in: () => query,
        select: () => query,
        boundingClientRect(callback: Callback) { measured = callback; return query; },
        exec() { measured?.({ height: 480, width: 390, top: 0, bottom: 480 }); },
      };
      return query;
    },
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, screenTop: 0, safeArea: { top: 47, bottom: 810, left: 0, right: 390 }, screenHeight: 844 }),
    getSystemInfoSync: () => ({ platform: "devtools", windowWidth: 390, windowHeight: 844, safeArea: { bottom: 810 }, screenHeight: 844 }),
    onKeyboardHeightChange() {},
    offKeyboardHeightChange() {},
    nextTick: (callback: Callback) => queueMicrotask(callback),
    pageScrollTo(options: Options) {
      scrolls.push(options.scrollTop);
      options.success?.({});
      options.complete?.({});
    },
  };
  const context = vm.createContext({
    console, wx,
    App: (definition: Options) => { app = definition; },
    Page: (definition: Options) => { assert(!definitions.has(registering), `duplicate Page registration: ${registering}`); definitions.set(registering, definition); },
    getApp: () => app,
    getCurrentPages: () => stack,
    setTimeout(callback: Callback, delay?: number, ...args: unknown[]) {
      const timer = setTimeout(() => { timers.delete(timer); callback(...args); }, delay);
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer: ReturnType<typeof setTimeout>) { timers.delete(timer); clearTimeout(timer); },
    queueMicrotask,
  });
  for (const name of forbiddenGlobals) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined", `${name} leaked into AppService`);

  function load(name: string): any {
    let filename = path.resolve(directory, name);
    if (!path.extname(filename)) filename += ".js";
    assert(filename.startsWith(`${path.resolve(directory)}${path.sep}`), "require escaped dist");
    const cached = modules.get(filename);
    if (cached) return cached.exports;
    const record = { exports: {} };
    modules.set(filename, record);
    loads.set(path.relative(directory, filename), (loads.get(path.relative(directory, filename)) ?? 0) + 1);
    const factory = vm.runInContext(`(function(require,module,exports){\n${readFileSync(filename, "utf8")}\n})`, context, { filename });
    factory((specifier: string) => {
      assert(specifier.startsWith("."), `bundle retained external dependency ${specifier}`);
      return load(path.relative(directory, path.resolve(path.dirname(filename), specifier)));
    }, record, record.exports);
    return record.exports;
  }

  function respond(request: Request, data: unknown, statusCode = 200) {
    assert(!request.settled, "request already finished");
    // A completed transport callback may race an abort; bundled generation guards must ignore it.
    request.settled = true;
    request.options.success?.({ statusCode, data, header: { "content-type": "application/json" } });
    request.options.complete?.({ statusCode, data });
  }
  function chunk(request: Request, text: string, bytewise = false) {
    // Use the built codec and realm-owned ArrayBuffer, never a host TextEncoder in the sandbox.
    const bytes = vm.runInContext(`new TextEncoder().encode(${JSON.stringify(text)})`, context) as Uint8Array;
    const parts = bytewise ? Array.from(bytes, (_, index) => bytes.slice(index, index + 1)) : [bytes];
    for (const part of parts) for (const callback of request.chunks) callback({ data: part.buffer });
  }
  return {
    context, definitions, loads, requests, clipboard, previews, patches, scrolls, stack, wx, load, open, respond, chunk,
    get pullDownStops() { return pullDownStops; },
    setModalConfirm(value: boolean) { modalConfirm = value; },
    resetPatches() { patches.length = 0; },
    resetScrolls() { scrolls.length = 0; },
    loadAll() {
      load("app.js");
      app.onLaunch?.();
      for (const route of routes) { registering = route; load(`${route}.js`); }
      assert.equal(definitions.size, 8, "all eight bundles must register a page");
      const runtime = load("lib/runtime.js");
      assert.equal(runtime, load("lib/runtime.js"), "shared CommonJS runtime must retain identity");
      assert.equal(loads.get("lib/runtime.js"), 1);
      for (const name of ["fetch", "URL", "AbortController"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "undefined");
      for (const name of ["TextEncoder", "TextDecoder"]) assert.equal(vm.runInContext(`typeof ${name}`, context), "function", `built encoding did not initialize ${name}`);
      return runtime;
    },
    close() {
      const pages = new Set([...stack, ...tabs.values()]);
      stack.length = 0;
      tabs.clear();
      for (const page of pages) page.onUnload?.();
      for (const request of requests) request.abort();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}


export type AppService = ReturnType<typeof createAppService>;
