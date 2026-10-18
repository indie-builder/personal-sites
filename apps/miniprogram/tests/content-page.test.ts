import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { stashRow, type FeedRow } from "../src/lib/runtime";

type PageInstance = WechatMiniprogram.Page.TrivialInstance;
type Pending = {
  url: string;
  aborted: boolean;
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: (error: { errMsg: string }) => void;
};
let definitions: PageInstance[] = [];
let originalPage: PropertyDescriptor | undefined;
let originalWx: PropertyDescriptor | undefined;
let requests: Pending[];
let navigated: string[];
let copied: string[];
let paused: string[];
let previews: string[][];
let stoppedRefresh: number;
let scrolls: number[];
let windowWidth = 390;
let mounted: PageInstance[];
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const tap = (dataset: Record<string, unknown>) => ({ currentTarget: { dataset } });
const news = (id: string) => ({ id, title: `新闻 ${id}`, summary: "公开摘要", category: "ai-models", sourceName: "公开来源", publishedAt: "2026-10-18", selected: false });
const curation = (id: string) => ({
  id, title: "策展标题", summary: "导读", text: "# 原帖\n\n公开正文", author: { handle: "public", name: "公开作者" },
  source: { platform: "x", label: "X", url: "https://x.com/public/status/1" }, publishedAt: "2026-10-18", collectedAt: null,
  tags: ["公开标签"], attachments: ["图片", "视频"], media: [
    { url: "https://example.com/image.jpg", previewUrl: "https://example.com/preview.jpg", videoUrl: null, width: 800, height: 600 },
    { url: "https://example.com/poster.jpg", previewUrl: "https://example.com/poster.jpg", videoUrl: "https://video.twimg.com/ext_tw_video/123/pu/vid/a.mp4", width: 720, height: 1280 },
  ],
});
function mount(index: number): PageInstance {
  const definition = definitions[index];
  if (!definition) throw new Error("Missing registered Page");
  const page: PageInstance = {
    ...definition,
    data: structuredClone(definition.data),
    setData(update: Record<string, unknown>, callback?: () => void) {
      for (const [path, value] of Object.entries(update)) {
        const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
        let target = this.data;
        for (const key of keys.slice(0, -1)) target = target[key];
        target[keys[keys.length - 1]!] = value;
      }
      callback?.();
    },
  };
  for (const [key, value] of Object.entries(page)) if (typeof value === "function") page[key] = value.bind(page);
  mounted.push(page);
  return page;
}
function respond(index: number, data: unknown, statusCode = 200) {
  const request = requests[index];
  if (!request) throw new Error(`Missing request ${index}`);
  request.success({ statusCode, data });
}

beforeAll(async () => {
  originalPage = Object.getOwnPropertyDescriptor(globalThis, "Page");
  Object.defineProperty(globalThis, "Page", { configurable: true, value: (definition: PageInstance) => definitions.push(definition) });
  await import("../src/pages/home/index");
  await import("../src/pages/detail/index");
  await import("../src/pages/about/index");
  if (originalPage) Object.defineProperty(globalThis, "Page", originalPage);
  else Reflect.deleteProperty(globalThis, "Page");
});
afterAll(() => { definitions = []; });
beforeEach(() => {
  requests = []; navigated = []; copied = []; paused = []; previews = []; stoppedRefresh = 0; scrolls = []; mounted = []; windowWidth = 390;
  originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "wx", { configurable: true, value: {
    request(options: Omit<Pending, "aborted">) {
      const request = { ...options, aborted: false };
      requests.push(request);
      return { abort() { request.aborted = true; request.fail({ errMsg: "request:fail abort" }); } };
    },
    navigateTo(options: { url: string }) { navigated.push(options.url); },
    switchTab(options: { url: string }) { navigated.push(options.url); },
    stopPullDownRefresh() { stoppedRefresh++; },
    setNavigationBarTitle() {},
    hideTabBar() {}, showTabBar() {},
    showToast() {},
    setClipboardData(options: { data: string; success: () => void }) { copied.push(options.data); options.success(); },
    previewImage(options: { urls: string[] }) { previews.push(options.urls); },
    createVideoContext(id: string) { return { pause() { paused.push(id); } }; },
    pageScrollTo(options: { scrollTop: number; duration: number; complete: () => void }) { scrolls.push(options.scrollTop); options.complete(); },
    getWindowInfo() { return { windowWidth }; },
  } });
});
afterEach(() => {
  mounted.forEach((page) => page.onUnload?.());
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("native home page lifecycle", () => {
  test("whitelists the initial section, preserves per-section results and strips raw transport data from the view", async () => {
    const home = mount(0);
    home.onLoad?.({ section: "javascript:bad" });
    expect(home.data.section).toBe("ai-news");
    expect(requests[0]?.url).toContain("/api/ai-news?offset=0&limit=50");
    respond(0, { items: [news("a")], hasMore: true }); await settle();
    expect(home.data.feeds["ai-news"].items[0]).not.toHaveProperty("raw");
    home.openAbout();
    expect(navigated).toEqual(["/pages/about/index"]);
    expect(home.data.section).toBe("ai-news");
    home.selectSection(tap({ section: "curation" }));
    respond(1, { items: [curation("c")], hasMore: true }); await settle();
    home.selectSection(tap({ section: "ai-news" }));
    expect(requests).toHaveLength(2);
    expect(home.data.feeds["ai-news"].items[0].id).toBe("a");
    home.onReachBottom?.();
    expect(requests[2]?.url).toContain("offset=1");
    respond(2, { items: [news("b")], hasMore: false }); await settle();
    expect(home.data.feeds["ai-news"].items.map((row: FeedRow) => row.id)).toEqual(["a", "b"]);
    home.onReachBottom?.();
    expect(requests).toHaveLength(3);
    home.openDetail(tap({ id: "a" }));
    expect(navigated[1]).toBe("/pages/detail/index?section=ai-news&id=a");
  });

  test("stores each section's scroll position and restores it without recording the switch itself", async () => {
    const home = mount(0); home.onLoad?.({}); respond(0, { items: [news("a")], hasMore: true }); await settle();
    home.onPageScroll?.({ scrollTop: 900 });
    home.selectSection(tap({ section: "curation" }));
    expect(scrolls).toEqual([0]);
    respond(1, { items: [curation("c")], hasMore: true }); await settle();
    home.onPageScroll?.({ scrollTop: 240 });
    home.selectSection(tap({ section: "ai-news" }));
    expect(scrolls).toEqual([0, 900]);
    home.onPageScroll?.({ scrollTop: 950 });
    home.selectSection(tap({ section: "curation" }));
    expect(scrolls).toEqual([0, 900, 240]);
    home.selectSection(tap({ section: "design" }));
    expect(scrolls[3]).toBe(0);
    home.selectSectionIndex({ detail: { value: "4" } });
    expect(home.data.section).toBe("open-source");
    expect(home.data.sectionIndex).toBe(4);
    expect(scrolls[4]).toBe(0);
    home.selectSectionIndex({ detail: { value: "0" } });
    expect(scrolls[5]).toBe(950);
  });

  test("ignores superseded or unloaded render callbacks before scrolling", async () => {
    const home = mount(0); home.onLoad?.({}); respond(0, { items: [news("a")], hasMore: true }); await settle();
    home.onPageScroll?.({ scrollTop: 900 });
    const callbacks: (() => void)[] = [];
    const update = home.setData.bind(home);
    home.setData = (patch: Record<string, unknown>, callback?: () => void) => {
      update(patch);
      if (callback) callbacks.push(callback);
    };
    home.selectSection(tap({ section: "curation" }));
    home.selectSection(tap({ section: "ai-news" }));
    callbacks.shift()?.();
    expect(scrolls).toEqual([]);
    callbacks.shift()?.();
    expect(scrolls).toEqual([900]);
    home.selectSection(tap({ section: "design" }));
    home.onUnload?.();
    callbacks.shift()?.();
    expect(scrolls).toEqual([900]);
  });

  test("error prevents automatic reloads until retry, and refresh always ends its native indicator", async () => {
    const home = mount(0); home.onLoad?.({ section: "curation" });
    respond(0, { error: "暂时不可用" }, 503); await settle();
    home.onReachBottom?.();
    home.selectSection(tap({ section: "design" }));
    respond(1, { items: [], hasMore: false }); await settle();
    home.selectSection(tap({ section: "curation" }));
    expect(requests).toHaveLength(2);
    home.retry();
    respond(2, { items: [curation("retained")], hasMore: true }); await settle();
    home.onPullDownRefresh?.();
    expect(home.data.feeds.curation.refreshing).toBe(true);
    home.onPullDownRefresh?.();
    expect(stoppedRefresh).toBe(1);
    requests[3]!.fail({ errMsg: "request:fail offline" }); await settle();
    expect(stoppedRefresh).toBe(2);
    expect(home.data.feeds.curation.items[0].id).toBe("retained");
    expect(home.data.feeds.curation.refreshing).toBe(false);
  });

  test("retry preserves each section's failed load mode and refresh replaces retained rows", async () => {
    const home = mount(0); home.onLoad?.({});
    respond(0, { items: [news("old-a"), news("old-b")], hasMore: true }); await settle();
    home.onPullDownRefresh?.();
    expect(requests[1]?.url).toContain("offset=0");
    requests[1]!.fail({ errMsg: "request:fail offline" }); await settle();
    expect(home.data.feeds["ai-news"].items.map((row: FeedRow) => row.id)).toEqual(["old-a", "old-b"]);
    expect(home.data.feeds["ai-news"].hasMore).toBe(true);

    home.selectSection(tap({ section: "curation" }));
    respond(2, { items: [curation("other")], hasMore: false }); await settle();
    home.selectSection(tap({ section: "ai-news" }));
    home.loadFeed();
    expect(requests).toHaveLength(3);
    home.retry();
    expect(requests[3]?.url).toContain("/api/ai-news?offset=0");
    expect(home.data.feeds["ai-news"].refreshing).toBe(true);
    respond(3, { items: [news("fresh")], hasMore: true }); await settle();
    expect(home.data.feeds["ai-news"].items.map((row: FeedRow) => row.id)).toEqual(["fresh"]);
    expect(home.data.feeds.curation.items[0].id).toBe("other");

    home.onReachBottom?.();
    expect(requests[4]?.url).toContain("offset=1");
    requests[4]!.fail({ errMsg: "request:fail offline" }); await settle();
    home.retry();
    expect(requests[5]?.url).toContain("offset=1");
    respond(5, { items: [news("next")], hasMore: false }); await settle();
    expect(home.data.feeds["ai-news"].items.map((row: FeedRow) => row.id)).toEqual(["fresh", "next"]);
  });

  test("unload aborts every in-flight section and blocks late page writes", async () => {
    const home = mount(0); home.onLoad?.({});
    home.selectSection(tap({ section: "curation" }));
    home.onUnload?.();
    expect(requests.every((request) => request.aborted)).toBe(true);
    const snapshot = JSON.stringify(home.data);
    respond(0, { items: [news("late")], hasMore: false });
    respond(1, { items: [curation("late")], hasMore: false }); await settle();
    expect(JSON.stringify(home.data)).toBe(snapshot);
  });
});

describe("native detail page lifecycle", () => {
  test("news supports cold fetch, HTTP retry and durable detail sharing", async () => {
    const detail = mount(1); detail.onLoad?.({ section: "ai-news", id: "news /1" });
    expect(requests[0]?.url).toContain("/api/ai-news/news%20%2F1");
    respond(0, { error: "动态暂不可用" }, 500); await settle();
    expect(detail.data.error).toBe("动态暂不可用");
    detail.loadDetail();
    respond(1, { item: { ...news("news /1"), reason: "推荐理由", url: "https://example.com/article" } }); await settle();
    expect(detail.data.loading).toBe(false);
    expect(detail.data.title).toBe("新闻 news /1");
    expect(detail.onShareAppMessage?.({ from: "menu", target: undefined })).toMatchObject({ path: "/pages/detail/index?section=ai-news&id=news%20%2F1" });
    detail.copySource(); detail.copyWebsite(); detail.copyMarkdown();
    expect(copied[0]).toBe("https://example.com/article");
    expect(copied[1]).toContain("/ai-news/news%20%2F1");
    expect(copied[2]).toContain("## 推荐理由\n\n推荐理由");
  });

  test("uses curation carrier without a made-up detail API, previews images, retries media and pauses on hide", async () => {
    const raw = curation("native-curation");
    stashRow("curation", { id: raw.id, title: raw.title, summary: raw.summary, date: "2026-10-18", meta: "X · @public", thumbnail: "", raw });
    const detail = mount(1); detail.onLoad?.({ section: "curation", id: raw.id }); await settle();
    expect(requests).toHaveLength(0);
    expect(detail.data.tagsText).toBe("公开标签");
    expect(detail.data.nodes.length).toBeGreaterThan(0);
    expect(detail.data.photos).toHaveLength(1);
    expect(detail.data.videos).toHaveLength(1);
    expect(detail.data.videos[0].videoHeight).toBe(608);
    expect(detail.onShareAppMessage?.({ from: "menu", target: undefined })).toMatchObject({ path: "/pages/home/index?section=curation" });
    detail.previewImage(tap({ index: 0 }));
    expect(previews).toEqual([["https://example.com/image.jpg"]]);
    detail.mediaError(tap({ index: 1 }));
    expect(detail.data.media[1].videoError).toBe(true);
    detail.retryMedia(tap({ index: 1 }));
    expect(detail.data.media[1].videoError).toBe(false);
    detail.onHide?.();
    expect(paused).toContain("detail-video-1");
    expect(detail.data.media[1].videoUrl).toContain("/api/x-media?url=");
  });

  test("keeps source video proportions, recalculates on resize and preserves multi-image preview order", async () => {
    const raw = curation("grid");
    raw.media = [
      raw.media[0]!,
      { url: "https://example.com/second.jpg", previewUrl: "", videoUrl: "", width: 600, height: 900 },
      { url: "https://example.com/third.jpg", previewUrl: "", videoUrl: "", width: 600, height: 600 },
    ];
    stashRow("curation", { id: raw.id, title: raw.title, summary: raw.summary, date: "", meta: "", thumbnail: "", raw });
    const grid = mount(1); grid.onLoad?.({ section: "curation", id: raw.id }); await settle();
    expect(grid.data.photos).toHaveLength(3);
    expect(grid.data.videos).toHaveLength(0);
    expect(grid.data.gridHeight).toBe(110);
    grid.previewImage(tap({ index: 2 }));
    expect(previews).toEqual([["https://example.com/image.jpg", "https://example.com/second.jpg", "https://example.com/third.jpg"]]);
    windowWidth = 700;
    grid.onResize?.();
    expect(grid.data.gridHeight).toBe(213);
  });

  test("derives video height from real dimensions and falls back to 16:9", async () => {
    const vertical = curation("vertical");
    vertical.media = [{ url: "https://example.com/p.jpg", previewUrl: "", videoUrl: "https://video.twimg.com/ext_tw_video/9/pu/vid/v.mp4", width: 720, height: 1280 }];
    stashRow("curation", { id: vertical.id, title: "竖屏", summary: "", date: "", meta: "", thumbnail: "", raw: vertical });
    const portrait = mount(1); portrait.onLoad?.({ section: "curation", id: vertical.id }); await settle();
    expect(portrait.data.media[0].videoHeight).toBe(608);
    windowWidth = 700;
    portrait.onResize?.();
    expect(portrait.data.media[0].videoHeight).toBe(1159);
    windowWidth = 390;
    const missing = curation("missing-size");
    missing.media = [{ url: "", previewUrl: "", videoUrl: "https://video.twimg.com/ext_tw_video/9/pu/vid/v.mp4", width: 0, height: 0 }];
    stashRow("curation", { id: missing.id, title: "无尺寸", summary: "", date: "", meta: "", thumbnail: "", raw: missing });
    const fallback = mount(1); fallback.onLoad?.({ section: "curation", id: missing.id }); await settle();
    expect(fallback.data.media[0].videoHeight).toBe(192);
  });

  test("expired curation shows an explicit recovery and invalid routes do not request anything", async () => {
    const detail = mount(1); detail.onLoad?.({ section: "design", id: "missing-native-carrier" }); await settle();
    expect(detail.data.error).toContain("失效");
    detail.returnToFeed();
    expect(navigated).toContain("/pages/home/index");
    const invalid = mount(1); invalid.onLoad?.({ section: "not-a-feed", id: "id" });
    expect(invalid.data.retryable).toBe(false);
    expect(invalid.data.error).toContain("链接不完整");
    expect(requests).toHaveLength(0);
  });

  test("citation EventChannel renders safe readable text, rejects malformed payloads and cleans its listener", () => {
    const detail = mount(1);
    let listener: ((source: unknown) => void) | undefined;
    let removed = false;
    detail.getOpenerEventChannel = () => ({
      emit() {},
      once() {},
      on(name: string, callback: (source: unknown) => void) { expect(name).toBe("citation"); listener = callback; },
      off(name: string, callback: (source: unknown) => void) { removed = name === "citation" && callback === listener; },
    });
    detail.onLoad?.({ citation: "1" });
    expect(detail.data.error).toContain("引用资料未能读取");
    listener?.({ title: "来源", content: 1, sourceUrl: "https://example.com", scope: "profile" });
    expect(detail.data.error).toContain("格式异常");
    listener?.({ title: "来源", content: "# 引用\n\n<script>不执行</script>", sourceUrl: "javascript:alert(1)", scope: "profile" });
    expect(detail.data.error).toBe("");
    expect(detail.data.meta).toBe("个人资料");
    expect(detail.data.sourceUrl).toBe("");
    expect(JSON.stringify(detail.data.nodes)).toContain("<script>不执行</script>");
    expect(requests).toHaveLength(0);
    detail.onUnload?.();
    expect(removed).toBe(true);
    listener?.({ title: "迟到", content: "", sourceUrl: "", scope: "profile" });
    expect(detail.data.title).toBe("来源");
  });

  test("unload aborts news and prevents a late result from rendering", async () => {
    const detail = mount(1); detail.onLoad?.({ section: "ai-news", id: "aborted" });
    detail.onUnload?.();
    expect(requests[0]?.aborted).toBe(true);
    respond(0, { item: { ...news("aborted"), reason: "", url: "https://example.com" } }); await settle();
    expect(detail.data.title).toBe("");
  });
});

test("about shows canonical public bio and expands real career with working copy links", () => {
  const about = mount(2);
  expect(about.data.profile.name).toBe("陈远");
  expect(about.data.profile.paragraphs).toHaveLength(3);
  about.toggleCareer(); expect(about.data.careerOpen).toBe(true);
  about.toggleCareer(); expect(about.data.careerOpen).toBe(false);
  expect(about.data.career.map((item: { company: string }) => item.company)).toEqual(["PLUS数字科技", "红星美凯龙", "喜马拉雅", "PayerMax"]);
  about.copyProfileLink(tap({ url: "https://www.yuque.com/defulat-coder" }));
  expect(copied[0]).toBe("https://www.yuque.com/defulat-coder");
  about.copyProfileLink(tap({ url: "javascript:bad" }));
  expect(copied).toHaveLength(1);
});
