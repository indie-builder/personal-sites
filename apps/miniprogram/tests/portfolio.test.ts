import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Effect, PORTFOLIO_ORIGIN, Schema } from "../src/lib/runtime";
import {
  CollectionPage, Site, Tools, WorkDetail, collectionPath, collectionWork,
  getProducts, getSite, getTools, getWork, normalizeFilters, productDestination, projectKind, projectPath, projectTitle,
} from "../src/portfolio/api";
import { item, mockPortfolioRequests, page } from "./portfolio-fixture";

let requests: ReturnType<typeof mockPortfolioRequests>;
beforeEach(() => { requests = mockPortfolioRequests(); });
afterEach(() => { requests.restore(); });

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
    const request = await requests.nextRequest();
    expect(request.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio`);
    const ids = ["layout-compositions", "muse", "design-engineer-tools", "personal-sites", "future-product"];
    requests.respond(request, { items: ids.map((id) => ({ id, name: id, summary: "介绍", date: "2026-09-03", dateLabel: "上线", cover: "" })) });
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
    const request = await requests.nextRequest();
    expect(request.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/muse/id%2Fwith%20%3F`);
    requests.respond(request, { item: item("id/with ?") });
    expect((await detail).item.sourceURL).toBe("https://example.com/work");
    const tools = Effect.runPromise(getTools());
    const toolsRequest = await requests.nextRequest();
    expect(toolsRequest.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/tools`);
    requests.respond(toolsRequest, { categories: [] });
    expect((await tools).categories).toEqual([]);
    const site = Effect.runPromise(getSite());
    const siteRequest = await requests.nextRequest();
    expect(siteRequest.url).toBe(`${PORTFOLIO_ORIGIN}/api/portfolio/site`);
    requests.respond(siteRequest, { video: "", poster: "", website: "https://example.com", description: "介绍" });
    expect((await site).description).toBe("介绍");
  });
});
