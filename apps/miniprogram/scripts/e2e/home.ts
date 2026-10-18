import assert from "node:assert/strict";
import type { AppService } from "./app-service";
import { date, nextRequest, settled, tap } from "./scenario";

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
export async function verifyHome(harness: AppService) {
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
