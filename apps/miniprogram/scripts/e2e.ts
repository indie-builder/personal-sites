import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const routes = ["home", "ask", "portfolio", "about", "detail", "collection", "work", "project"].map((name) => `pages/${name}/index`);
const site = "https://default-coder.lovemyrmb.cn";
const portfolio = "https://portfolio.default-coder.lovemyrmb.cn";
const date = "2026-10-18T08:00:00.000Z";
const forbiddenGlobals = ["fetch", "URL", "TextEncoder", "TextDecoder", "AbortController"];
// WeChat rejects a single setData payload above 1 MiB; every call in this harness is measured against it.
export const setDataLimit = 1024 * 1024;

export function packageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? packageFiles(path.join(directory, entry.name)).map((name) => `${entry.name}/${name}`) : [entry.name]);
}

export function verifyPackage(directory = path.join(root, "dist")): void {
  const app = JSON.parse(readFileSync(path.join(directory, "app.json"), "utf8"));
  assert.deepEqual([...app.pages].sort(), [...routes].sort());
  const expected = ["app.js", "encoding.js", "lib/runtime.js", "app.json", "app.wxss", "theme.json", "sitemap.json", "assets/avatar.png",
    ...["home", "ask", "portfolio", "about"].flatMap(name => ["muted", "light", "dark"].map(tone => `assets/navigation/${name}-${tone}.png`)),
    ...routes.flatMap((route) => ["js", "json", "wxml", "wxss"].map((extension) => `${route}.${extension}`))];
  const actual = packageFiles(directory);
  assert.deepEqual(actual.sort(), expected.sort(), "dist must contain only the public package whitelist");
  assert(actual.reduce((bytes, name) => bytes + statSync(path.join(directory, name)).size, 0) <= 2 * 1024 * 1024, "main package exceeds 2 MiB");
  for (const name of actual.filter((name) => /\.(js|json|wxml|wxss)$/.test(name))) {
    const content = readFileSync(path.join(directory, name), "utf8");
    assert(!/(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]+|sk-proj-[A-Za-z0-9_-]+)/.test(content), `secret material in ${name}`);
    assert(!/(?:data\/sensitive|knowledge\/sensitive|tools\/smaug\/\.state)/.test(content), `sensitive path in ${name}`);
  }
}

type Callback = (...args: any[]) => void;
type Options = Record<string, any>;
type PageInstance = Options & { data: Options; setData: (patch: Options, callback?: Callback) => void };
type Request = {
  options: Options; aborted: boolean; settled: boolean; chunks: Callback[]; headers: Callback[]; abort: () => void;
  readonly url: string;
  success: (response: unknown) => void;
  fail: (error: unknown) => void;
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
        // The Pending shape used by page tests destructures request options directly.
        get url() { return options.url; },
        success(response: unknown) {
          if (this.settled) return;
          this.settled = true;
          options.success?.(response);
          options.complete?.(response);
        },
        fail(error: unknown) {
          if (this.settled) return;
          this.settled = true;
          options.fail?.(error);
          options.complete?.(error);
        },
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
    context, definitions, loads, requests, storage, clipboard, previews, toasts, patches, scrolls, stack, wx, load, open, respond, chunk,
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

type Harness = ReturnType<typeof createAppService>;
const tap = (dataset: Options) => ({ currentTarget: { dataset }, detail: {} });

async function settled(check: () => boolean, description: string) {
  for (let turn = 0; turn < 100; turn++) {
    if (check()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail(`AppService did not settle: ${description}`);
}

async function nextRequest(harness: Harness, pathname: string) {
  await settled(() => harness.requests.some((request) => !request.settled && !request.aborted && new URL(request.options.url).pathname === pathname), pathname);
  return harness.requests.find((request) => !request.settled && !request.aborted && new URL(request.options.url).pathname === pathname)!;
}

function news(id: string) {
  return { id, category: "ai-products", publishedAt: date, selected: false, sourceName: "公开测试来源", summary: `公开摘要 ${id}`, title: `动态 ${id}` };
}
function curation(id: string, platform = "x") {
  return {
    id, title: `收藏 ${id}`, summary: "公开收藏摘要", text: "## 正文\n公开阅读内容", author: { handle: "public-fixture", name: "公开作者" },
    source: { platform, label: platform === "x" ? "X" : "抖音", url: `https://${platform === "x" ? "x.com/public/status" : "www.douyin.com/video"}/${id}` },
    publishedAt: date, collectedAt: date, tags: ["设计"], attachments: ["图片"],
    media: [{ type: "photo", url: "https://images.example.com/public.jpg", previewUrl: null, videoUrl: null, width: 1200, height: 800, durationMs: null }],
    design: null,
  };
}
const source = (id: string, content = "## 陈远\n这是公开引用正文。"): Options => ({ id, title: `公开资料 ${id}`, content, sourceUrl: `${site}/about`, scope: "profile", publishedAt: null, section: null, sourceId: "profile" });
const work = (id: string) => ({ id, title: `布局 ${id}`, category: "editorial", topic: "minimal", author: "公开作者", text: "公开作品说明", sourceURL: "https://example.com/original", thumbnail: "https://images.example.com/work.jpg", media: [{ id: "image", kind: "image", url: "https://images.example.com/work.jpg", poster: "", width: 1200, height: 800 }] });
const collectionPage = (ids: string[], hasMore = false) => ({ items: ids.map(work), total: 3, hasMore, categories: [{ id: "editorial", name: "编辑", count: 3 }], topics: [{ id: "minimal", name: "简约", count: 3 }], attribution: "CC BY 4.0 · 公开测试作者" });

async function verifyHome(harness: Harness) {
  const home = harness.wx.switchTab({ url: "/pages/home/index" });
  let request = await nextRequest(harness, "/api/ai-news");
  assert.equal(new URL(request.options.url).searchParams.get("offset"), "0");
  harness.respond(request, { items: Array.from({ length: 50 }, (_, index) => news(`news-${index}`)), hasMore: true });
  await settled(() => home.data.feeds["ai-news"].loaded && !home.data.feeds["ai-news"].loading, "home initial feed");
  home.onReachBottom();
  request = await nextRequest(harness, "/api/ai-news");
  assert.equal(new URL(request.options.url).searchParams.get("offset"), "50");
  harness.respond(request, { items: Array.from({ length: 50 }, (_, index) => news(`news-${index + 49}`)), hasMore: true });
  await settled(() => !home.data.feeds["ai-news"].loading, "home more");
  assert.equal(home.data.feeds["ai-news"].items.length, 99, "overlapping pages must deduplicate visible rows");
  home.onReachBottom();
  request = await nextRequest(harness, "/api/ai-news");
  assert.equal(new URL(request.options.url).searchParams.get("offset"), "100", "cursor advances by raw page length, not deduplicated rows");
  harness.respond(request, { items: [news("last")], hasMore: false });
  await settled(() => !home.data.feeds["ai-news"].loading, "home last page");
  home.onPullDownRefresh();
  request = await nextRequest(harness, "/api/ai-news");
  assert.equal(new URL(request.options.url).searchParams.get("offset"), "0");
  harness.respond(request, { items: [news("fresh")], hasMore: false });
  await settled(() => !home.data.feeds["ai-news"].refreshing && harness.pullDownStops > 0, "home refresh");
  assert.equal(home.data.feeds["ai-news"].items[0].id, "fresh");
  home.openDetail(tap({ id: "fresh" }));
  const newsDetail = harness.stack.at(-1)!;
  request = await nextRequest(harness, "/api/ai-news/fresh");
  harness.respond(request, { item: { ...news("fresh"), reason: "公开推荐理由", selected: true, url: "https://example.com/public-news" } });
  await settled(() => !newsDetail.data.loading, "news detail API");
  assert.equal(newsDetail.data.title, "动态 fresh");
  assert.equal(newsDetail.data.reason, "公开推荐理由");
  assert.match(newsDetail.data.meta, /精选/);
  harness.wx.navigateBack();
  for (const section of ["curation", "design", "douyin", "open-source"]) {
    home.selectSection(tap({ section }));
    request = await nextRequest(harness, `/api/${section}`);
    const item = section === "open-source"
      ? { slug: "public/repo", repository: "public/repo", sourceSummary: "公开仓库摘要", checkedAt: date, dimensions: ["agent-skills"], status: "active", type: "tool", category: "tools" }
      : curation(section, section === "douyin" ? "douyin" : "x");
    harness.respond(request, { items: [item], hasMore: false });
    await settled(() => home.data.feeds[section].loaded && !home.data.feeds[section].loading, `home ${section}`);
  }
  assert.equal(home.data.feeds["open-source"].items[0].meta.includes("agent-skills"), false, "open-source dimensions use public labels");
  // 栏目位置只在真实滚动后保存；切换时的恢复滚动不得写回旧值。
  home.onPageScroll({ scrollTop: 420 });
  harness.resetScrolls();
  home.selectSection(tap({ section: "curation" }));
  assert.deepEqual(harness.scrolls, [0], "new section starts at the top");
  await settled(() => home.data.feeds.curation.loaded, "cached curation");
  home.onPageScroll({ scrollTop: 900 });
  const count = harness.requests.length;
  home.openDetail(tap({ id: "curation" }));
  const detail = harness.stack.at(-1)!;
  await settled(() => !detail.data.loading, "carried curation detail");
  assert(JSON.stringify(detail.data).includes("公开阅读内容"), "detail must read the row stored by home in the shared runtime");
  assert.equal(harness.requests.length, count, "carried curation detail must not invent an ID API");
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), home);
  assert.equal(home.data.section, "curation");
  assert.equal(home.data.feeds["ai-news"].items[0].id, "fresh");
  // 返回后仍在原栏目，继续滚动才更新位置；切换回来恢复 950。
  home.onPageScroll({ scrollTop: 950 });
  harness.resetScrolls();
  home.selectSectionIndex({ detail: { value: "0" } });
  assert.equal(home.data.section, "ai-news");
  assert.equal(home.data.sectionIndex, 0);
  assert.deepEqual(harness.scrolls, [0], "untouched sections start at the top");
  home.onPageScroll({ scrollTop: 60 });
  harness.resetScrolls();
  home.selectSection(tap({ section: "curation" }));
  assert.deepEqual(harness.scrolls, [950], "section switch restores the saved position");
  assert.equal(home.data.sectionLabel, "每日关注");
  harness.resetScrolls();
  home.selectSectionIndex({ detail: { value: "0" } });
  assert.deepEqual(harness.scrolls, [60], "the dropdown restores ai-news's last real scroll");
  harness.resetScrolls();
  home.selectSection(tap({ section: "open-source" }));
  assert.deepEqual(harness.scrolls, [420], "a section scrolled earlier restores its own value");
  assert.equal(home.data.section, "open-source");
  console.log("PASS home: initial / more / refresh / five sections / carried detail / per-section scroll restore / native back");
}

async function verifyAsk(harness: Harness) {
  const ask = harness.wx.switchTab({ url: "/pages/ask/index" });
  assert(ask, "Ask page registered");
  // Page action names are intentionally exact: a renamed or disconnected UI action must fail the harness.
  ask.onScopeChange({ detail: { value: "1" } });
  ask.onInput({ detail: { value: "介绍一下陈远" } });
  ask.send();
  let request = await nextRequest(harness, "/api/ask");
  const original = request.options.data;
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.enableChunked, true);
  assert.equal(request.options.dataType, "text");
  assert.equal(request.options.timeout, 120_000);
  assert.equal(original.format, "text");
  assert.equal(original.scope, "profile");
  assert.equal(original.question, "介绍一下陈远");
  for (const key of ["visitorId", "conversationId"]) assert.match(original[key], /^[A-Za-z0-9_-]{16,128}$/);
  harness.chunk(request, ': heartbeat\r\nevent: text\r\ndata: {"delta":"陈远 👋【1】"}\r\n\r\n', true);
  harness.chunk(request, 'event: text\ndata: {"delta":\ndata: "，公开回答"}\n\n', true);
  await settled(() => ask.data.messages.at(-1)?.text === "陈远 👋【1】，公开回答", "Ask text before sources");
  // 晚到来源前，引用数字仍是普通文本；页面数据不保存来源正文。
  assert.equal(ask.data.messages.at(-1).sourceCount, 0);
  assert.equal(ask.data.messages.at(-1).sourceViews.length, 0);
  assert.equal(ask.data.messages.at(-1).sources, undefined, "page data must not mirror raw sources");
  assert.equal(JSON.stringify(ask.data.messages.at(-1).parts).includes('"ref"'), false);
  assert.equal(ask.data.streaming, true);
  const citationSource = source("profile-public");
  harness.chunk(request, `event: sources\ndata: ${JSON.stringify({ sources: [citationSource] })}\n\nevent: done\ndata: {}\n\n`, true);
  harness.respond(request, "event: text\ndata: {\"delta\":\"MUST NOT DUPLICATE\"}\n\n");
  await settled(() => !ask.data.streaming, "Ask complete");
  assert.equal(ask.data.messages.at(-1).text, "陈远 👋【1】，公开回答");
  assert.equal(ask.data.messages.at(-1).sourceViews[0].title, citationSource.title);
  assert.equal(ask.data.messages.at(-1).sourceCount, 1);
  assert.equal(ask.data.messages.at(-1).status, "complete");
  assert(JSON.stringify(ask.data.messages.at(-1).parts).includes('"ref"'), "late sources enable native citation refs");
  assert.equal(JSON.stringify(ask.data).includes(citationSource.content), false, "source content stays in the controller");
  const answerId = ask.data.messages.at(-1).id;
  ask.copyAnswer(tap({ messageId: answerId }));
  assert.equal(harness.clipboard.at(-1), "陈远 👋【1】，公开回答");
  ask.onInput({ detail: { value: "返回后保留草稿" } });
  const controller = ask.controller;
  const completed = JSON.stringify(ask.data.messages);
  const requestCount = harness.requests.length;
  const home = harness.wx.switchTab({ url: "/pages/home/index" });
  assert.equal(home.data.section, "open-source", "cached home retains its selected feed");
  home.openAbout();
  assert.equal(harness.stack.at(-1)?.route, "pages/about/index");
  harness.wx.switchTab({ url: "/pages/ask/index" });
  assert.equal(harness.stack.at(-1), ask, "Ask tab must reuse its page instance");
  assert.equal(ask.controller, controller, "Ask onLoad must not recreate the conversation controller");
  assert.equal(ask.visible, true, "cached Ask must receive onShow");
  assert.equal(ask.data.draft, "返回后保留草稿");
  assert.equal(JSON.stringify(ask.data.messages), completed);
  assert.equal(harness.requests.length, requestCount, "tab revisits must not reload public data or resend Ask");

  ask.onScroll({ detail: { scrollTop: 600, scrollHeight: 1600 } });
  ask.onScroll({ detail: { scrollTop: 200, scrollHeight: 1600 } });
  assert.equal(ask.followLatest, false);
  assert.equal(ask.data.showLatest, true);
  const scroll = { top: ask.scrollTop, target: ask.data.scrollTarget, tail: ask.tail, viewport: ask.viewportHeight };
  ask.openSource(tap({ messageId: answerId, index: 0 }));
  const citation = harness.stack.at(-1)!;
  assert.equal(citation.data.citation, true);
  assert.equal(citation.data.title, citationSource.title);
  assert.equal(citation.data.text, citationSource.content);
  assert.equal(citation.data.error, "");
  citation.copySource();
  assert.equal(harness.clipboard.at(-1), citationSource.sourceUrl);
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), ask);
  assert.equal(ask.data.draft, "返回后保留草稿");
  assert.equal(ask.data.messages.at(-1).status, "complete");
  assert.equal(ask.controller, controller);
  assert.deepEqual({ top: ask.scrollTop, target: ask.data.scrollTarget, tail: ask.tail, viewport: ask.viewportHeight }, scroll, "citation return must retain the reader's scroll state variables");
  assert.equal(ask.followLatest, false);
  assert.equal(ask.data.showLatest, true);

  ask.send();
  request = await nextRequest(harness, "/api/ask");
  assert.equal(request.options.data.conversationId, original.conversationId);
  const lateCallbacks = [...request.chunks];
  harness.chunk(request, 'event: text\ndata: {"delta":"部分回答"}\n\n');
  ask.stop();
  await settled(() => !ask.data.streaming, "Ask stop");
  assert.equal(request.aborted, true, "stop must abort the real wx RequestTask");
  assert.equal(ask.data.messages.at(-1).status, "stopped");
  const stopped = JSON.stringify(ask.data.messages);
  const lateBytes = vm.runInContext('new TextEncoder().encode(\'event: text\\ndata: {"delta":"late"}\\n\\n\').buffer', harness.context);
  for (const callback of lateCallbacks) callback({ data: lateBytes });
  assert.equal(JSON.stringify(ask.data.messages), stopped, "late chunks changed a stopped answer");

  ask.onScopeChange({ detail: { value: "2" } });
  ask.retry();
  request = await nextRequest(harness, "/api/ask");
  assert.equal(request.options.data.question, "返回后保留草稿");
  assert.equal(request.options.data.scope, "profile", "retry must use the question's original scope");
  harness.respond(request, { error: "公开测试限流，请稍后重试" }, 429);
  await settled(() => !ask.data.streaming && Boolean(ask.data.error), "Ask HTTP failure");
  assert.equal(ask.data.messages.at(-1).status, "error");
  assert.match(ask.data.error, /公开测试限流/);
  ask.retry();
  request = await nextRequest(harness, "/api/ask");
  harness.chunk(request, 'event: text\ndata: {"delta":"恢复回答"}\n\nevent: sources\ndata: {"sources":[]}\n\nevent: done\ndata: {}\n\n');
  await settled(() => !ask.data.streaming, "Ask retry recovery");
  assert.equal(ask.data.messages.at(-1).status, "complete");
  assert.equal(ask.data.messages.at(-1).text, "恢复回答");

  harness.setModalConfirm(false);
  const retained = JSON.stringify(ask.data.messages);
  ask.newConversation();
  assert.equal(JSON.stringify(ask.data.messages), retained);
  harness.setModalConfirm(true);
  ask.newConversation();
  assert.equal(ask.data.messages.length, 0);
  assert.equal(ask.data.draft, "");
  ask.onInput({ detail: { value: "新对话问题" } });
  ask.send();
  request = await nextRequest(harness, "/api/ask");
  assert.notEqual(request.options.data.conversationId, original.conversationId);
  assert.equal(request.options.data.visitorId, original.visitorId);
  harness.chunk(request, 'event: text\ndata: {"delta":"缺少完成事件"}\n\n');
  harness.respond(request, "");
  await settled(() => !ask.data.streaming && Boolean(ask.data.error), "Ask truncated EOF");
  assert.equal(ask.data.messages.at(-1).status, "error");
  ask.retry();
  request = await nextRequest(harness, "/api/ask");
  harness.chunk(request, 'event: text\ndata: {"delta":42}\n\n');
  await settled(() => !ask.data.streaming && Boolean(ask.data.error), "Ask malformed frame");
  assert.equal(request.aborted, true);
  ask.retry();
  request = await nextRequest(harness, "/api/ask");
  harness.chunk(request, 'event: error\ndata: {"message":"公开测试服务错误"}\n\n');
  await settled(() => !ask.data.streaming && Boolean(ask.data.error), "Ask SSE error");
  assert.match(ask.data.error, /公开测试服务错误/);
  ask.retry();
  request = await nextRequest(harness, "/api/ask");
  harness.chunk(request, 'event: done\ndata: {}\n\n');
  await settled(() => !ask.data.streaming, "Ask empty done");
  assert.equal(ask.data.messages.at(-1).status, "complete");
  assert(ask.data.messages.at(-1).text.length > 0, "empty done must show a fallback");
  ask.onInput({ detail: { value: "离开页面会停止" } });
  ask.send();
  request = await nextRequest(harness, "/api/ask");
  harness.chunk(request, 'event: text\ndata: {"delta":"离开前的部分回答"}\n\n');
  ask.onInput({ detail: { value: "切回后继续编辑" } });
  harness.wx.switchTab({ url: "/pages/home/index" });
  assert.equal(request.aborted, true, "switchTab must invoke Ask onHide and abort its request");
  assert.equal(ask.visible, false);
  harness.wx.switchTab({ url: "/pages/about/index" });
  harness.wx.switchTab({ url: "/pages/ask/index" });
  assert.equal(harness.stack.at(-1), ask);
  assert.equal(ask.controller, controller);
  assert.equal(ask.visible, true);
  assert.equal(ask.data.streaming, false);
  assert.equal(ask.data.messages.at(-1).status, "stopped");
  assert.equal(ask.data.messages.at(-1).text, "离开前的部分回答");
  assert.equal(ask.data.draft, "切回后继续编辑");

  // 真实信任边界：12 轮、每轮 6 条大来源与 4,000 字回答，每次 setData 都不得超过 1 MiB。
  harness.setModalConfirm(true);
  ask.newConversation();
  ask.onInput({ detail: { value: "保留的压力测试草稿" } });
  harness.resetPatches();
  const rounds = 12;
  const contents = "来源正文".repeat(500); // 4,000 characters per source
  const answer = "长回答【1】【2】【3】【4】【5】【6】".repeat(200).slice(0, 4000);
  for (let round = 0; round < rounds; round++) {
    ask.onInput({ detail: { value: `第 ${round + 1} 个压力测试问题` } });
    ask.send();
    // send clears the draft; keep editing mid-stream to prove the composer survives long rendering.
    ask.onInput({ detail: { value: `草稿 ${round + 1}` } });
    request = await nextRequest(harness, "/api/ask");
    const sources = Array.from({ length: 6 }, (_, index) => source(`来源 ${round}-${index}`, `${contents}${index}`));
    // Sources arrive before and after text in alternating rounds; both must enable inline refs.
    if (round % 2 === 0) harness.chunk(request, `event: sources\ndata: ${JSON.stringify({ sources })}\n\n`);
    for (let offset = 0; offset < answer.length; offset += 100) harness.chunk(request, `event: text\ndata: ${JSON.stringify({ delta: answer.slice(offset, offset + 100) })}\n\n`);
    if (round % 2 === 1) harness.chunk(request, `event: sources\ndata: ${JSON.stringify({ sources })}\n\n`);
    harness.chunk(request, "event: done\ndata: {}\n\n");
    await settled(() => !ask.data.streaming, `Ask stress round ${round + 1}`);
    assert.equal(ask.data.messages.at(-1).status, "complete");
    assert.equal(ask.data.messages.at(-1).text.length, answer.length);
    assert.equal(ask.data.messages.at(-1).sourceCount, 6);
    assert.equal(ask.data.draft, `草稿 ${round + 1}`, "the draft survives each streamed answer");
  }
  assert.equal(ask.controller?.state.messages.length, rounds * 2, "the controller keeps the full conversation");
  assert(ask.data.messages.length > 0 && ask.data.messages.length <= 20, "the rendered history respects count and byte budgets");
  assert.equal(ask.data.hiddenCount, rounds * 2 - ask.data.messages.length, "earlier history is reachable behind the explicit control");
  assert.equal(JSON.stringify(ask.data).includes(contents), false, "page data must never carry source content");
  ask.onInput({ detail: { value: "保留的压力测试草稿" } });
  assert.equal(ask.data.draft, "保留的压力测试草稿");
  const largestPatch = Math.max(...harness.patches.map((patch) => patch.bytes));
  assert(largestPatch <= setDataLimit, `setData exceeded 1 MiB: ${largestPatch}`);
  assert(harness.patches.some((patch) => patch.keys.some((key) => key.startsWith("messages["))), "Ask must patch answer fields by path");
  let previousHidden = ask.data.hiddenCount;
  let olderPages = 0;
  while (ask.data.hiddenCount > 0) {
    ask.loadEarlier();
    assert(ask.data.hiddenCount < previousHidden, "older-page navigation must make progress");
    assert(ask.data.messages.length <= 20, "earlier pages remain bounded");
    previousHidden = ask.data.hiddenCount;
    assert(++olderPages <= rounds * 2, "older history remains reachable");
  }
  assert.equal(ask.data.messages[0].id, ask.controller.state.messages[0].id);
  ask.returnLatest();
  assert(ask.data.messages.length > 0 && ask.data.messages.length <= 20);
  assert.equal(ask.data.messages.at(-1).id, ask.controller.state.messages.at(-1).id);
  assert.equal(ask.data.hiddenCount, rounds * 2 - ask.data.messages.length);
  assert(Math.max(...harness.patches.map((patch) => patch.bytes)) <= setDataLimit, "history navigation must also respect the payload bound");
  ask.onInput({ detail: { value: "草稿仍在" } });
  harness.wx.switchTab({ url: "/pages/home/index" });
  harness.wx.switchTab({ url: "/pages/ask/index" });
  assert.equal(ask.data.draft, "草稿仍在");
  assert.equal(ask.visible, true);
  console.log("PASS Ask: UTF-8 / multiline SSE / late sources / done / copy / cached tabs and draft / citation scroll state / stop / retry / new dialogue / HTTP and SSE errors / EOF / tab hide cancellation / 12-round bounded rendering under 1 MiB");
}

async function verifyPortfolio(harness: Harness) {
  const page = harness.wx.switchTab({ url: "/pages/portfolio/index" });
  let request = await nextRequest(harness, "/api/portfolio");
  assert.equal(new URL(request.options.url).origin, portfolio);
  harness.respond(request, { items: ["layout-compositions", "muse", "design-engineer-tools", "personal-sites"].map((id) => ({ id, name: id, summary: "公开作品集", date: "2026-10-18", dateLabel: "2026", cover: "" })) });
  await settled(() => !page.data.loading && JSON.stringify(page.data).includes("layout-compositions"), "portfolio products");
  page.openProduct(tap({ id: "layout-compositions" }));
  const collection = harness.stack.at(-1)!;
  assert.equal(collection.route, "pages/collection/index");
  assert.equal(collection.data.view, "index", "layouts open on the category shelf");
  let collectionRequest = await nextRequest(harness, "/api/portfolio/layouts");
  assert.equal(new URL(collectionRequest.options.url).origin, portfolio);
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("limit"), "24");
  harness.respond(collectionRequest, collectionPage(["one", "two"], true));
  await settled(() => collection.data.loaded && !collection.data.loading, "portfolio collection");
  assert.equal(collection.data.shelf.length, 1);
  assert.equal(collection.data.shelfTotal, 3);
  // The shelf and unfiltered grid share the first page; browsing reuses it without a request.
  const beforeBrowse = harness.requests.length;
  collection.browseAll();
  assert.equal(collection.data.view, "grid");
  await settled(() => collection.data.items.length === 2, "collection browse all");
  assert.equal(harness.requests.length, beforeBrowse, "browse all reuses the unfiltered page");
  const firstRow = collection.data.items[0];
  assert.deepEqual(Object.keys(firstRow).sort(), ["author", "category", "id", "thumbnail", "title", "topic", "video"], "list rows strip text and media");
  assert.equal(JSON.stringify(collection.data).includes("公开作品说明"), false, "work bodies stay in the controller");
  collection.onReachBottom();
  collectionRequest = await nextRequest(harness, "/api/portfolio/layouts");
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("offset"), "2");
  harness.respond(collectionRequest, collectionPage(["two", "three"], false));
  await settled(() => !collection.data.loading, "collection pagination");
  assert.deepEqual(collection.data.items.map((item: Options) => item.id), ["one", "two", "three"]);
  assert.equal(collection.data.total, 3);
  collection.inputQuery({ detail: { value: "  排版  " } });
  collection.search();
  collectionRequest = await nextRequest(harness, "/api/portfolio/layouts");
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("q"), "排版");
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("offset"), "0");
  harness.respond(collectionRequest, collectionPage(["one"]));
  await settled(() => !collection.data.loading, "collection search");
  collection.selectCategory({ detail: { value: "1" } });
  collectionRequest = await nextRequest(harness, "/api/portfolio/layouts");
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("cat"), "editorial");
  harness.respond(collectionRequest, collectionPage(["one"]));
  await settled(() => !collection.data.loading, "collection category");
  collection.selectTopic({ detail: { value: "1" } });
  collectionRequest = await nextRequest(harness, "/api/portfolio/layouts");
  assert.equal(new URL(collectionRequest.options.url).searchParams.get("theme"), "minimal");
  harness.respond(collectionRequest, collectionPage(["one", "three", "two"]));
  await settled(() => !collection.data.loading, "collection topic");
  collection.openWork(tap({ id: "one" }));
  const detail = harness.stack.at(-1)!;
  const detailRequest = await nextRequest(harness, "/api/portfolio/layouts/one");
  harness.respond(detailRequest, { item: work("one") });
  await settled(() => !detail.data.loading && Boolean(detail.data.item), "portfolio work detail");
  assert.equal(detail.data.item.sourceURL, work("one").sourceURL);
  assert.equal(detail.data.item.title, work("one").title);
  assert.match(detail.data.attribution, /CC BY 4\.0/);
  detail.previewImage(tap({ url: work("one").media[0].url }));
  assert.equal(harness.previews.at(-1)?.current, work("one").media[0].url);
  detail.copySource();
  assert.equal(harness.clipboard.at(-1), work("one").sourceURL);
  detail.mediaFailed(tap({ id: "image" }));
  assert.equal(detail.data.failedMedia.image, true);
  detail.retryMedia(tap({ id: "image" }));
  assert.equal(detail.data.failedMedia.image, false);
  assert.equal(detail.data.readingIndex, 0, "the whole filtered loaded set is handed off");
  assert.equal(detail.data.readingStart, 0);
  assert.equal(detail.data.readingCount, 3);
  const depth = harness.stack.length;
  let requestCount = harness.requests.length;
  detail.previousWork();
  assert.equal(harness.requests.length, requestCount, "previous at the first work is a no-op");
  detail.nextWork();
  const stale = await nextRequest(harness, "/api/portfolio/layouts/three");
  assert.equal(detail.data.readingIndex, 1, "reader follows the filtered collection order");
  detail.nextWork();
  const next = await nextRequest(harness, "/api/portfolio/layouts/two");
  assert.equal(stale.aborted, true, "moving again cancels the previous work request");
  harness.respond(next, { item: work("two") });
  await settled(() => !detail.data.loading && detail.data.item?.id === "two", "adjacent work");
  harness.respond(stale, { item: work("three") });
  assert.equal(detail.data.item.id, "two", "late adjacent response cannot replace the current work");
  assert.equal(detail.data.readingIndex, 2);
  requestCount = harness.requests.length;
  detail.nextWork();
  assert.equal(harness.requests.length, requestCount, "next at the last work is a no-op");
  detail.previousWork();
  const previous = await nextRequest(harness, "/api/portfolio/layouts/three");
  harness.respond(previous, { item: work("three") });
  await settled(() => !detail.data.loading && detail.data.item?.id === "three", "previous work");
  assert.equal(harness.stack.length, depth, "adjacent reading must reuse the same page");
  assert.equal(harness.stack.at(-1), detail);
  assert.deepEqual(harness.scrolls.at(-1), 0, "adjacent reading scrolls the reused page to the top");
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), collection);
  assert.equal(collection.data.draft, "排版");
  assert.equal(collection.data.categoryIndex, 1);
  assert.equal(collection.data.topicIndex, 1);
  assert.deepEqual(collection.data.items.map((item: Options) => item.id), ["one", "three", "two"]);
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), page);

  page.openProduct(tap({ id: "muse" }));
  const muse = harness.stack.at(-1)!;
  assert.equal(muse.data.view, "grid", "muse opens directly in the image grid");
  collectionRequest = await nextRequest(harness, "/api/portfolio/muse");
  harness.respond(collectionRequest, collectionPage(["muse-one"]));
  await settled(() => muse.data.loaded && !muse.data.loading, "muse collection");
  muse.openWork(tap({ id: "muse-one" }));
  const museDetail = harness.stack.at(-1)!;
  const museRequest = await nextRequest(harness, "/api/portfolio/muse/muse-one");
  harness.respond(museRequest, { item: work("muse-one") });
  await settled(() => !museDetail.data.loading, "muse work");
  assert.equal(museDetail.data.readingCount, 1);
  requestCount = harness.requests.length;
  museDetail.previousWork();
  museDetail.nextWork();
  assert.equal(harness.requests.length, requestCount, "single-work collection has no adjacent requests");
  harness.wx.navigateBack();
  harness.wx.navigateBack();

  const cold = harness.wx.navigateTo({ url: "/pages/work/index?collection=layouts&id=cold" });
  const coldRequest = await nextRequest(harness, "/api/portfolio/layouts/cold");
  harness.respond(coldRequest, { item: work("cold") });
  await settled(() => !cold.data.loading, "cold work detail");
  assert.equal(cold.data.readingIndex, -1);
  assert.equal(cold.data.readingCount, 0);
  requestCount = harness.requests.length;
  cold.previousWork();
  cold.nextWork();
  assert.equal(harness.requests.length, requestCount, "cold share link cannot invent adjacent works");
  harness.wx.navigateBack();

  page.openProduct(tap({ id: "design-engineer-tools" }));
  const tools = harness.stack.at(-1)!;
  assert.equal(tools.route, "pages/project/index");
  assert.equal(tools.data.kind, "tools");
  request = await nextRequest(harness, "/api/portfolio/tools");
  harness.respond(request, { categories: [{ id: "public", name: "公开工具", tools: [{ name: "设计工具", url: "https://example.com/tool", icon: "" }] }] });
  await settled(() => !tools.data.loading && tools.data.categories.length > 0, "project tools");
  tools.copyUrl(tap({ url: tools.data.categories[0].tools[0].url }));
  assert.equal(harness.clipboard.at(-1), "https://example.com/tool");
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), page, "project uses native back to the product index");

  page.openProduct(tap({ id: "personal-sites" }));
  const sitePage = harness.stack.at(-1)!;
  assert.equal(sitePage.route, "pages/project/index");
  assert.equal(sitePage.data.kind, "site");
  request = await nextRequest(harness, "/api/portfolio/site");
  harness.respond(request, { video: "https://media.example.com/public.mp4", poster: "https://images.example.com/poster.jpg", website: site, description: "公开个人网站" });
  await settled(() => !sitePage.data.loading && Boolean(sitePage.data.site), "project site");
  assert.equal(sitePage.data.site.website, site);
  sitePage.videoFailed();
  assert.equal(sitePage.data.videoFailed, true);
  sitePage.retryVideo();
  assert.equal(sitePage.data.videoFailed, false);
  harness.wx.navigateBack();

  const invalid = harness.wx.navigateTo({ url: "/pages/project/index?kind=other" });
  await settled(() => invalid.data.invalid, "invalid project kind");
  requestCount = harness.requests.length;
  invalid.loadContent();
  assert.equal(harness.requests.length, requestCount, "invalid project kinds never request");
  harness.wx.navigateBack();
  assert.equal(harness.stack.at(-1), page);
  console.log("PASS portfolio: four products / shelf and grid / pagination / search and filters / whole-set handoff and cancellation / cold work detail / image preview and retry / source copy / project tools and site / native back");
}

export async function verifyAppService() {
  verifyPackage();
  const harness = createAppService();
  try {
    harness.loadAll();
    console.log("PASS eight page bundles registered; shared CommonJS runtime initialized once without browser globals");
    await verifyHome(harness);
    await verifyAsk(harness);
    await verifyPortfolio(harness);
  } finally {
    harness.close();
  }
}

if (import.meta.main) {
  console.log("AppService contract harness, not real simulator. Deterministic public fixtures; no live Ask request.");
  const build = Bun.spawn([process.execPath, "scripts/build.ts"], { cwd: root, stdout: "inherit", stderr: "inherit" });
  assert.equal(await build.exited, 0, "miniprogram build failed");
  assert(existsSync(path.join(root, "dist/lib/runtime.js")), "build did not emit shared runtime");
  await verifyAppService();
  console.log("PASS AppService contract harness, not real simulator");
}
