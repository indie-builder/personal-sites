import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createAppService, root } from "../scripts/e2e";
import * as Fiber from "effect/Fiber";
import { Effect, PORTFOLIO_ORIGIN, Schema } from "../src/lib/runtime";
import {
  CollectionPage, Site, Tools, WorkDetail, collectionPath, collectionWork, createCollection,
  getProducts, getSite, getTools, getWork, normalizeFilters, productDestination, projectKind, projectPath, projectTitle,
} from "../src/portfolio/api";

const item = (id: string) => ({
  id, title: `作品 ${id}`, category: "构图", topic: "空间留白", author: "作者", text: "说明",
  sourceURL: "https://example.com/work", thumbnail: "https://example.com/thumb.webp", media: [],
});
const page = (ids: string[], hasMore = true) => ({
  items: ids.map(item), total: 80, hasMore,
  categories: [{ id: "composition", name: "构图", count: 80 }],
  topics: [{ id: "space", name: "空间留白", count: 12 }], attribution: "创作者 · CC BY 4.0",
});

interface Pending {
  url: string;
  aborted: boolean;
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: (error: { errMsg: string }) => void;
}
type Request = ReturnType<typeof createAppService>["requests"][number];
let pending: Pending[];
let waiters: ((request: Pending) => void)[];
let originalWx: PropertyDescriptor | undefined;
const nextRequest = (): Promise<Pending> => {
  const request = pending.shift();
  return request ? Promise.resolve(request) : new Promise((resolve) => waiters.push(resolve));
};
const respond = (request: Pending, data: unknown, statusCode = 200) => request.success({ statusCode, data });

beforeEach(() => {
  pending = [];
  waiters = [];
  originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  Object.defineProperty(globalThis, "wx", { configurable: true, value: {
    request(options: Omit<Pending, "aborted">) {
      const request: Pending = { ...options, aborted: false };
      const waiter = waiters.shift();
      if (waiter) waiter(request); else pending.push(request);
      return { abort() { request.aborted = true; options.fail({ errMsg: "request:fail abort" }); } };
    },
    showToast() {},
  } });
});
afterEach(() => {
  if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("public portfolio contract", () => {
  test("validates real sourceURL capitalization, media types, empty media and nonnegative counts", () => {
    expect(Schema.decodeUnknownSync(WorkDetail)({ item: item("001") }).item.media).toEqual([]);
    const { sourceURL: _sourceURL, ...withoutSource } = item("001");
    expect(() => Schema.decodeUnknownSync(WorkDetail)({ item: { ...withoutSource, sourceUrl: "https://example.com" } })).toThrow();
    expect(() => Schema.decodeUnknownSync(WorkDetail)({ item: {
      ...item("001"), media: [{ id: "1", kind: "html", url: "https://example.com", poster: "", width: 1, height: 1 }],
    } })).toThrow();
    expect(() => Schema.decodeUnknownSync(CollectionPage)({ ...page([]), total: -1 })).toThrow();
    expect(() => Schema.decodeUnknownSync(CollectionPage)({ ...page([]), hasMore: "true" })).toThrow();
    expect(() => Schema.decodeUnknownSync(Tools)({ categories: [{ id: "one", name: "工具", tools: [{ name: "工具", url: 1, icon: "" }] }] })).toThrow();
    expect(() => Schema.decodeUnknownSync(Site)({ video: "", poster: "", website: "" })).toThrow();
  });

  test("normalizes and encodes search/category/topic with page size 24, omits theme for muse", () => {
    const filters = { q: "  留白 & 空间  ", cat: "构图/1", theme: "经典 & 法则" };
    expect(collectionPath("layouts", 48, filters)).toBe(`/api/portfolio/layouts?offset=48&limit=24&q=${encodeURIComponent("留白 & 空间")}&cat=${encodeURIComponent("构图/1")}&theme=${encodeURIComponent("经典 & 法则")}`);
    expect(collectionPath("muse", 0, filters)).not.toContain("theme=");
    expect(normalizeFilters("layouts", { ...filters, q: "界".repeat(201) }).q).toHaveLength(200);
    expect(() => collectionPath("layouts", 0, { ...filters, q: "界".repeat(199) + "😀" })).not.toThrow();
  });

  test("uses independent origin and exposes the four supported native products only", async () => {
    const result = Effect.runPromise(getProducts());
    const request = await nextRequest();
    expect(request.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio`);
    const ids = ["layout-compositions", "muse", "design-engineer-tools", "personal-sites", "future-product"];
    respond(request, { items: ids.map((id) => ({ id, name: id, summary: "介绍", date: "2026-09-03", dateLabel: "上线", cover: "" })) });
    expect((await result).map((product) => product.id)).toEqual(ids.slice(0, 4));
    expect(ids.slice(0, 4).map(productDestination)).toEqual(["layouts", "muse", "tools", "site"]);
    expect(productDestination("future-product")).toBeUndefined();
    expect(projectPath("tools")).toBe("/pages/project/index?kind=tools");
    expect(projectPath("site")).toBe("/pages/project/index?kind=site");
    expect(projectKind("tools")).toBe("tools");
    expect(projectKind("site")).toBe("site");
    expect(projectKind("layouts")).toBeUndefined();
    expect(projectKind(undefined)).toBeUndefined();
    expect(projectTitle("tools")).toBe("设计工程工具");
    expect(projectTitle("site")).toBe("个人网站");
  });

  test("projects list rows to display fields without text, source or full media", () => {
    const work = item("001");
    const video = { id: "clip", kind: "video" as const, url: "https://example.com/clip.mp4", poster: "", width: 1200, height: 800 };
    expect(collectionWork({ ...work, media: [video] })).toEqual({
      id: "001", title: "作品 001", category: "构图", topic: "空间留白", author: "作者",
      thumbnail: "https://example.com/thumb.webp", video: true,
    });
    expect(collectionWork(item("002"))).not.toHaveProperty("text");    expect(collectionWork(item("002")).video).toBe(false);
  });

  test("reads cold details, tools and site using validated independent endpoints", async () => {
    const detail = Effect.runPromise(getWork("muse", "id/with ?"));
    const request = await nextRequest();
    expect(request.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/muse/id%2Fwith%20%3F`);
    respond(request, { item: item("id/with ?") });
    expect((await detail).item.sourceURL).toBe("https://example.com/work");
    const tools = Effect.runPromise(getTools());
    const toolsRequest = await nextRequest();
    expect(toolsRequest.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/tools`);
    respond(toolsRequest, { categories: [] });
    expect((await tools).categories).toEqual([]);
    const site = Effect.runPromise(getSite());
    const siteRequest = await nextRequest();
    expect(siteRequest.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/site`);
    respond(siteRequest, { video: "", poster: "", website: "https://example.com", description: "介绍" });
    expect((await site).description).toBe("介绍");
  });
});

const built = existsSync(`${root}/dist/lib/runtime.js`);
async function settled(check: () => boolean) {
  for (let turn = 0; turn < 100; turn += 1) {
    if (check()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Portfolio AppService did not settle");
}

describe("built native portfolio actions", () => {
  test.skipIf(!built)("reads adjacent loaded works in place, cancels old details and preserves filtered collection", async () => {
    const harness = createAppService();
    const paused: string[] = [];
    Object.assign(harness.wx, { createVideoContext: (id: string) => ({ pause() { paused.push(id); } }) });
    const take = async (id: string) => {
      const path = `/api/portfolio/layouts/${id}`;
      await settled(() => harness.requests.some((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path));
      return harness.requests.find((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path)!;
    };
    try {
      harness.loadAll();
      const collection = harness.open("/pages/collection/index?collection=layouts");
      await settled(() => harness.requests.length === 1);
      harness.respond(harness.requests[0]!, page(["initial"]));
      await settled(() => !collection.data.loading);
      collection.inputQuery({ detail: { value: "  留白  " } });
      collection.search();
      await settled(() => harness.requests.length === 2);
      harness.respond(harness.requests[1]!, page(["a", "b", "c"], false));
      await settled(() => !collection.data.loading);
      const before = structuredClone(collection.data);
      collection.openWork({ currentTarget: { dataset: { id: "b" } } });
      const reader = harness.stack.at(-1)!;
      expect(reader.data.readingIndex).toBe(1);
      expect(reader.data.readingCount).toBe(3);
      expect(reader.readingIds).toEqual(["a", "b", "c"]);
      const video = { id: "clip", kind: "video", url: "https://example.com/clip.mp4", poster: "", width: 1200, height: 800 };
      harness.respond(await take("b"), { item: { ...item("b"), media: [video] } });
      await settled(() => !reader.data.loading);
      reader.nextWork();
      expect(paused).toEqual(["work-video-0"]);
      expect(reader.data.item).toBeNull();
      expect(reader.data.readingIndex).toBe(2);
      const late = await take("c");
      const atEnd = harness.requests.length;
      reader.nextWork();
      expect(harness.requests).toHaveLength(atEnd);
      reader.previousWork();
      const current = await take("b");
      expect(late.aborted).toBe(true);
      harness.respond(current, { item: item("b") });
      await settled(() => !reader.data.loading);
      harness.respond(late, { item: item("c") });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(reader.data.item.id).toBe("b");
      expect(reader.data.workId).toBe("b");
      reader.previousWork();
      const first = await take("a");
      harness.respond(first, { error: "暂时不可用" }, 500);
      await settled(() => !reader.data.loading);
      expect(reader.data.error).toContain("重试");
      const atStart = harness.requests.length;
      reader.previousWork();
      expect(harness.requests).toHaveLength(atStart);
      reader.loadWork();
      harness.respond(await take("a"), { item: item("a") });
      await settled(() => !reader.data.loading);
      expect(reader.data.error).toBe("");
      expect(reader.onShareAppMessage().path).toBe("/pages/work/index?collection=layouts&id=a");
      expect(harness.stack).toHaveLength(2);
      expect(harness.stack.at(-1)).toBe(reader);
      harness.wx.navigateBack();
      expect(harness.stack.at(-1)).toBe(collection);
      expect(collection.data).toEqual(before);
    } finally { harness.close(); }
  });

  test.skipIf(!built)("hands the whole loaded ID set with a true global ordinal and stays under 1 MiB", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const collection = harness.open("/pages/collection/index?collection=muse");
      await settled(() => harness.requests.length === 1);
      const ids = Array.from({ length: 1824 }, (_, index) => `work-${index}`);
      harness.respond(harness.requests[0]!, page(ids, false));
      await settled(() => !collection.data.loading);
      let openedUrl = "";
      let payloadSize = 0;
      const navigate = harness.wx.navigateTo;
      harness.wx.navigateTo = (options) => {
        openedUrl = options.url;
        return navigate({
          ...options,
          success: (result: { eventChannel: { emit: (name: string, payload: unknown) => void } }) => {
            const emit = result.eventChannel.emit.bind(result.eventChannel);
            result.eventChannel.emit = (name, payload) => {
              if (name === "workReading") payloadSize = Buffer.byteLength(JSON.stringify(payload));
              emit(name, payload);
            };
            options.success?.(result);
          },
        });
      };
      collection.openWork({ currentTarget: { dataset: { id: ids[201] } } });
      const reader = harness.stack.at(-1)!;
      expect(openedUrl).toBe(`/pages/work/index?collection=muse&id=${ids[201]}`);
      expect(reader.readingIds).toEqual(ids);
      expect(reader.data.readingCount).toBe(1824);
      expect(reader.data.readingIndex).toBe(201);
      expect(reader.data.readingStart).toBe(0);
      expect(payloadSize).toBeLessThan(1024 * 1024);
    } finally { harness.close(); }
  });

  test.skipIf(!built)("sends bounded decimal item patches while 1824 works stay in the controller", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const collection = harness.open("/pages/collection/index?collection=layouts");
      await settled(() => harness.requests.length === 1);
      collection.browseAll();
      const patches: { keys: string[]; bytes: number }[] = [];
      const setData = collection.setData;
      collection.setData = function (patch: Record<string, unknown>, callback?: () => void) {
        patches.push({ keys: Object.keys(patch), bytes: Buffer.byteLength(JSON.stringify(patch)) });
        return setData.call(this, patch, callback);
      };
      const pages = 76;
      for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        const ids = Array.from({ length: 24 }, (_, offset) => `work-${pageIndex * 24 + offset}`);
        harness.respond(await new Promise<Request>((resolve) => {
          const take = () => {
            const request = harness.requests.find((entry) => !entry.settled && !entry.aborted && new URL(entry.options.url).pathname === "/api/portfolio/layouts");
            if (request) resolve(request); else setImmediate(take);
          };
          take();
        }), { ...page(ids, pageIndex + 1 < pages), items: ids.map((id) => ({ ...item(id), text: "正文".repeat(1500) })) });
        await settled(() => !collection.data.loading);
        if (collection.data.hasMore) collection.onReachBottom();
      }
      expect(collection.controller.state.items).toHaveLength(1824);
      expect(collection.data.items).toHaveLength(1824);
      const itemKeys = new Set(collection.data.items.map((entry: Record<string, unknown>) => Object.keys(entry).sort().join(",")));
      expect([...itemKeys]).toEqual(["author,category,id,thumbnail,title,topic,video"]);
      expect(patches.filter((patch) => patch.keys.some((key) => /^items\[/u.test(key))).length).toBeGreaterThan(1);
      // No wholesale work list: the only plain `items` write clears before the indexed rows land.
      expect(patches.every((patch) => !patch.keys.includes("items") || patch.keys.length === 1)).toBe(true);
      expect(Math.max(...patches.map((patch) => patch.bytes))).toBeLessThan(1024 * 1024);
      expect(JSON.stringify(collection.data)).not.toContain("正文");
    } finally { harness.close(); }
  });

  test.skipIf(!built)("cold work links load standalone and reject invalid or unrelated reading handoffs", async () => {
    for (const collection of ["layouts", "muse"]) {
      const harness = createAppService();
      try {
        harness.loadAll();
        const reader = harness.open(`/pages/work/index?collection=${collection}&id=cold`);
        await settled(() => harness.requests.length === 1);
        harness.respond(harness.requests[0]!, { item: item("cold") });
        await settled(() => !reader.data.loading);
        expect(reader.data.item.id).toBe("cold");
        const channel = reader.getOpenerEventChannel();
        for (const payload of [
          null, { collection, ids: "cold" }, { collection, ids: ["other"] },
          { collection: collection === "layouts" ? "muse" : "layouts", ids: ["cold", "next"] },
          { collection, ids: ["cold", "cold"] }, { collection, ids: ["cold", ""] },
          { collection, ids: ["cold", 12] }, { collection, ids: ["cold", "x".repeat(301)] },
          { collection, ids: ["cold", "next"], start: -1 },
          { collection, ids: ["cold", "next"], start: 4 },
          { collection, ids: ["cold", "next"], start: 1.5 },
        ]) channel.emit("workReading", payload);
        reader.previousWork();
        reader.nextWork();
        expect(reader.data.readingCount).toBe(0);
        expect(reader.data.readingIndex).toBe(-1);
        expect(harness.requests).toHaveLength(1);
        expect(harness.stack).toHaveLength(1);
        expect(reader.onShareAppMessage().path).toBe(`/pages/work/index?collection=${collection}&id=cold`);
        reader.onUnload();
        channel.emit("workReading", { collection, ids: ["cold", "next"], start: 5 });
        expect(reader.data.readingCount).toBe(0);
        expect(reader.data.readingIndex).toBe(-1);
      } finally { harness.close(); }
    }
  });

  test.skipIf(!built)("navigates four products, preserves collection on native back and copies explicit sources", async () => {
    const harness = createAppService();
    const event = (dataset: Record<string, string>) => ({ currentTarget: { dataset } });
    const take = async (path: string) => {
      await settled(() => harness.requests.some((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path));
      const request = harness.requests.find((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path);
      if (!request) throw new Error(`Missing request ${path}`);
      return request;
    };
    try {
      harness.loadAll();
      const index = harness.open("/pages/portfolio/index");
      const products = ["layout-compositions", "muse", "design-engineer-tools", "personal-sites"];
      harness.respond(await take("/api/portfolio"), { items: products.map((id) => ({ id, name: id, summary: "公开作品", date: "2026-09-03", dateLabel: "上线", cover: "" })) });
      await settled(() => !index.data.loading);
      expect(index.data.products).toHaveLength(4);
      index.openProduct(event({ id: "layout-compositions" }));
      const collection = harness.stack.at(-1);
      if (!collection) throw new Error("Missing collection page");
      expect(collection.data.view).toBe("index");
      harness.respond(await take("/api/portfolio/layouts"), page(["a", "b"]));
      await settled(() => !collection.data.loading && collection.data.loaded);
      expect(collection.data.shelf.map((book: { id: string; number: string; count: number }) => [book.id, book.number, book.count])).toEqual([["composition", "01", 80]]);
      expect(collection.data.shelfTotal).toBe(80);
      collection.browseAll();
      expect(collection.data.view).toBe("grid");
      expect(harness.requests.filter((request) => !request.settled && request.options.url.includes("/api/portfolio/layouts"))).toHaveLength(0);
      expect(collection.data.items.map((item: { id: string }) => item.id)).toEqual(["a", "b"]);
      collection.onReachBottom();
      await settled(() => harness.requests.some((request) => !request.settled && request.options.url.includes("offset=2")));
      const more = harness.requests.find((request) => !request.settled && request.options.url.includes("offset=2"))!;
      expect(more.options.url).toContain("offset=2&limit=24");
      harness.respond(more, page(["b", "c"], false));
      await settled(() => !collection.data.loading);
      expect(collection.data.items.map((item: { id: string }) => item.id)).toEqual(["a", "b", "c"]);
      collection.inputQuery({ detail: { value: "  留白  " } });
      collection.search();
      const oldSearch = await take("/api/portfolio/layouts");
      collection.selectCategory({ detail: { value: "1" } });
      const category = await take("/api/portfolio/layouts");
      expect(oldSearch.aborted).toBe(true);
      expect(category.options.url).toContain("q=%E7%95%99%E7%99%BD&cat=composition");
      harness.respond(category, page(["filtered"], false));
      await settled(() => !collection.data.loading);
      collection.selectTopic({ detail: { value: "1" } });
      const theme = await take("/api/portfolio/layouts");
      expect(theme.options.url).toContain("theme=space");
      harness.respond(theme, page(["filtered"], false));
      await settled(() => !collection.data.loading);
      collection.openWork(event({ id: "filtered" }));
      const detail = harness.stack.at(-1);
      if (!detail) throw new Error("Missing detail page");
      expect(detail.data.readingStart).toBe(0);
      const media = { id: "image", kind: "image", url: "https://example.com/image.png", poster: "", width: 1200, height: 800 };
      harness.respond(await take("/api/portfolio/layouts/filtered"), { item: { ...item("filtered"), media: [media] } });
      await settled(() => !detail.data.loading);
      detail.copySource();
      detail.previewImage(event({ url: media.url }));
      expect(harness.clipboard.at(-1)).toBe("https://example.com/work");
      expect(harness.previews.at(-1)?.current).toBe(media.url);
      detail.mediaFailed(event({ id: "image" }));
      expect(detail.data.failedMedia.image).toBe(true);
      detail.retryMedia(event({ id: "image" }));
      expect(detail.data.failedMedia.image).toBe(false);
      expect(detail.onShareAppMessage().path).toContain("collection=layouts&id=filtered");
      harness.wx.navigateBack();
      expect(harness.stack.at(-1)).toBe(collection);
      expect(collection.data.draft).toBe("留白");
      expect(collection.data.items[0].id).toBe("filtered");
      harness.wx.navigateBack();
      index.openProduct(event({ id: "muse" }));
      const muse = harness.stack.at(-1);
      if (!muse) throw new Error("Missing muse page");
      harness.respond(await take("/api/portfolio/muse"), { ...page([], false), topics: [] });
      await settled(() => !muse.data.loading && muse.data.loaded);
      expect(muse.data.items).toEqual([]);
      harness.wx.navigateBack();
      index.openProduct(event({ id: "design-engineer-tools" }));
      const tools = harness.stack.at(-1);
      if (!tools) throw new Error("Missing project page");
      expect(tools.route).toBe("pages/project/index");
      expect(tools.data.kind).toBe("tools");
      harness.respond(await take("/api/portfolio/tools"), { categories: [{ id: "design", name: "设计", tools: [{ name: "工具", url: "https://example.com/tool", icon: "" }] }] });
      await settled(() => !tools.data.loading && tools.data.loaded);
      tools.copyUrl(event({ url: tools.data.categories[0].tools[0].url }));
      expect(harness.clipboard.at(-1)).toBe("https://example.com/tool");
      harness.wx.navigateBack();
      expect(harness.stack.at(-1)).toBe(index);
      index.openProduct(event({ id: "personal-sites" }));
      const site = harness.stack.at(-1);
      if (!site) throw new Error("Missing site page");
      expect(site.data.kind).toBe("site");
      harness.respond(await take("/api/portfolio/site"), { video: "https://example.com/promo.mp4", poster: "", website: "https://example.com/", description: "公开介绍" });
      await settled(() => !site.data.loading && Boolean(site.data.site));
      expect(site.data.site.description).toBe("公开介绍");
      site.videoFailed();
      expect(site.data.videoFailed).toBe(true);
      site.retryVideo();
      expect(site.data.videoFailed).toBe(false);
      expect(site.onShareAppMessage().path).toBe("/pages/project/index?kind=site");
      harness.wx.navigateBack();
      expect(index.data.products).toHaveLength(4);
    } finally { harness.close(); }
  });

  test.skipIf(!built)("clears a failed collection thumbnail only after a successful refresh", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const collection = harness.open("/pages/collection/index?collection=muse");
      await settled(() => harness.requests.length === 1);
      harness.respond(harness.requests[0]!, page(["a"]));
      await settled(() => !collection.data.loading);
      collection.imageFailed({ currentTarget: { dataset: { id: "a" } } });
      expect(collection.data.failedImages.a).toBe(true);
      collection.onPullDownRefresh();
      await settled(() => harness.requests.length === 2);
      harness.respond(harness.requests[1]!, { error: "暂时不可用" }, 500);
      await settled(() => !collection.data.loading);
      expect(collection.data.failedImages.a).toBe(true);
      collection.onPullDownRefresh();
      await settled(() => harness.requests.length === 3);
      harness.respond(harness.requests[2]!, page(["a"], false));
      await settled(() => !collection.data.loading);
      expect(collection.data.failedImages).toEqual({});
    } finally { harness.close(); }
  });

  test.skipIf(!built)("rejects invalid project links and clears failed cover flags after a successful refresh", async () => {
    const harness = createAppService();
    const event = (dataset: Record<string, string>) => ({ currentTarget: { dataset } });
    try {
      harness.loadAll();
      const invalid = harness.open("/pages/project/index?kind=layouts");
      expect(invalid.data.invalid).toBe(true);
      expect(harness.requests).toHaveLength(0);
      const index = harness.open("/pages/portfolio/index");
      await settled(() => harness.requests.length === 1);
      harness.respond(harness.requests[0]!, { items: [{ id: "muse", name: "灵感", summary: "介绍", date: "2026-09-03", dateLabel: "上线", cover: "https://example.com/cover.png" }] });
      await settled(() => !index.data.loading);
      index.imageFailed(event({ id: "muse" }));
      expect(index.data.failedImages.muse).toBe(true);
      index.loadContent();
      await settled(() => harness.requests.length === 2);
      harness.respond(harness.requests[1]!, { items: [{ id: "muse", name: "灵感", summary: "介绍", date: "2026-09-03", dateLabel: "上线", cover: "https://example.com/cover.png" }] });
      await settled(() => !index.data.loading);
      expect(index.data.failedImages).toEqual({});
    } finally { harness.close(); }
  });
});

describe("portfolio collection controller", () => {
  test("deduplicates within and across pages while advancing by raw rows", async () => {
    const collection = createCollection("layouts", () => {});
    const first = Effect.runPromise(collection.load());
    respond(await nextRequest(), page(["a", "a", "b"]));
    await first;
    const more = Effect.runPromise(collection.load("more"));
    const request = await nextRequest();
    expect(request.url).toContain("offset=3&limit=24");
    respond(request, page(["b", "c", "c"]));
    await more;
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    const third = Effect.runPromise(collection.load("more"));
    const thirdRequest = await nextRequest();
    expect(thirdRequest.url).toContain("offset=6&limit=24");
    respond(thirdRequest, page([], true));
    await third;
    expect(collection.state.hasMore).toBe(false);
    expect(collection.state.total).toBe(80);
    expect(collection.state.attribution).toBe("创作者 · CC BY 4.0");
  });

  test("refresh failure retains items and cursor; retry success clears error", async () => {
    const collection = createCollection("muse", () => {});
    const initial = Effect.runPromise(collection.load());
    respond(await nextRequest(), page(["a", "b"]));
    await initial;
    const refresh = Effect.runPromise(collection.load("refresh"));
    respond(await nextRequest(), { error: "服务不可用" }, 500);
    await refresh;
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(collection.state.error).toContain("重试");
    expect(collection.state.loading).toBe(false);
    const more = Effect.runPromise(collection.load("more"));
    const request = await nextRequest();
    expect(request.url).toContain("offset=2&limit=24");
    respond(request, page(["c"], false));
    await more;
    expect(collection.state.error).toBe("");
    expect(collection.state.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("new filters reset cursor and ignore old generation success or failure", async () => {
    for (const status of [200, 500]) {
      const collection = createCollection("layouts", () => {});
      const old = Effect.runPromise(collection.load());
      const oldRequest = await nextRequest();
      collection.setFilters({ q: "  网格  ", cat: "type", theme: "grid" });
      const current = Effect.runPromise(collection.load());
      const currentRequest = await nextRequest();
      expect(currentRequest.url).toContain("offset=0&limit=24&q=%E7%BD%91%E6%A0%BC&cat=type&theme=grid");
      respond(currentRequest, page(["new"], false));
      await current;
      respond(oldRequest, status === 200 ? page(["old"]) : { error: "old error" }, status);
      await old;
      expect(collection.state.items.map((item) => item.id)).toEqual(["new"]);
      expect(collection.state.error).toBe("");
      expect(collection.state.loading).toBe(false);
      expect(collection.state.filters.q).toBe("网格");
    }
  });

  test("prevents overlapping loads and cancellation aborts request and unlocks loading", async () => {
    const collection = createCollection("layouts", () => {});
    const fiber = Effect.runFork(collection.load());
    const request = await nextRequest();
    await Effect.runPromise(collection.load("more"));
    expect(pending).toHaveLength(0);
    expect(collection.state.loading).toBe(true);
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(request.aborted).toBe(true);
    expect(collection.state.loading).toBe(false);
    expect(collection.state.error).toBe("");
    const retry = Effect.runPromise(collection.load());
    respond(await nextRequest(), page(["ok"], false));
    await retry;
    expect(collection.state.items[0]?.id).toBe("ok");
  });

  test("malformed upstream data is recoverable and dispose prevents late updates", async () => {
    let updates = 0;
    const collection = createCollection("muse", () => { updates += 1; });
    const malformed = Effect.runPromise(collection.load());
    respond(await nextRequest(), { ...page(["a"]), total: "80" });
    await malformed;
    expect(collection.state.error).toContain("重试");
    expect(collection.state.items).toEqual([]);
    const delayed = Effect.runPromise(collection.load());
    const request = await nextRequest();
    collection.dispose();
    const before = updates;
    respond(request, page(["late"]));
    await delayed;
    expect(updates).toBe(before);
    expect(collection.state.items).toEqual([]);
  });
});
