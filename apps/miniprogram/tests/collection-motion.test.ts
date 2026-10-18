import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAppService } from "../scripts/e2e/app-service";
import { root } from "../scripts/e2e/package";

type Harness = ReturnType<typeof createAppService>;
type Page = ReturnType<Harness["open"]>;
type Request = Harness["requests"][number];
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const collectionPage = (ids: string[], hasMore = false) => ({
  items: ids.map((id) => ({
    id, title: `布局 ${id}`, category: "editorial", topic: "minimal", author: "公开作者", text: "公开作品说明",
    sourceURL: "https://example.com/original", thumbnail: "https://images.example.com/work.jpg",
    media: [{ id: "image", kind: "image", url: "https://images.example.com/work.jpg", poster: "", width: 1200, height: 800 }],
  })),
  total: 30, hasMore, categories: [{ id: "editorial", name: "编辑", count: 30 }],
  topics: [{ id: "minimal", name: "简约", count: 30 }], attribution: "CC BY 4.0 · 公开测试作者",
});
async function wait(check: () => boolean) {
  for (let turn = 0; turn < 100; turn += 1) {
    if (check()) return;
    await tick();
  }
  throw new Error("collection page did not settle");
}
// Respond to the next collection request and wait for the bounded patch to land.
async function respond(harness: Harness, page: Page, request: Request, data: unknown) {
  harness.respond(request, data);
  const items = (data as { items: unknown[] }).items.length;
  await wait(() => !page.data.loading && page.data.items.length >= items);
}

let harness: Harness;
beforeEach(() => { harness = createAppService(); harness.loadAll(); });
afterEach(() => { harness.close(); });

describe("collection appended-row motion", () => {
  test("binds the animation key and callback to the actual WXML loop index", () => {
    const template = readFileSync(path.join(root, "src/pages/collection/index.wxml"), "utf8");
    expect(template).toContain('wx:for-index="item_index"');
    expect(template).toContain('motion[item_index]');
    expect(template).toContain('data-index="{{item_index}}"');
    expect(template).toContain('bindanimationend="onEnterEnd"');
    expect(template).toContain('data-motion-token="{{motion[item_index].token}}"');
    const styles = readFileSync(path.join(root, "src/pages/collection/index.wxss"), "utf8");
    expect(styles).toContain("translateY(-6px) rotate(-2deg)");
    expect(styles).toContain("transform 160ms var(--ease-out)");
    expect(styles).toContain(".motion-reduced button.book.motion-control.motion-press { transform: none; }");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
  test("stages only the first four appended rows and clears each on animationend", async () => {
    const page = harness.open("/pages/collection/index?collection=muse");
    await wait(() => harness.requests.length === 1);
    await respond(harness, page, harness.requests[0]!, collectionPage(["a", "b"], true));
    expect(page.data.motion).toEqual({});
    page.onReachBottom();
    await wait(() => harness.requests.length === 2);
    await respond(harness, page, harness.requests[1]!, collectionPage(["c", "d", "e", "f", "g"], true));
    expect(page.data.items.map((item: { id: string }) => item.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    const token = page.motionToken;
    expect(page.data.motion).toEqual({
      2: { delay: 0, token, id: "c" }, 3: { delay: 30, token, id: "d" },
      4: { delay: 60, token, id: "e" }, 5: { delay: 90, token, id: "f" },
    });
    page.onEnterEnd({ currentTarget: { dataset: { index: 2, id: "c", motionToken: token } } });
    expect(Object.keys(page.data.motion)).toEqual(["3", "4", "5"]);
    // Rows outside the bounded four never enter, so their stale events are ignored.
    page.onEnterEnd({ currentTarget: { dataset: { index: 6 } } });
    expect(Object.keys(page.data.motion)).toHaveLength(3);
    for (const index of [3, 4, 5]) page.onEnterEnd({ currentTarget: { dataset: { index, id: page.data.items[index].id, motionToken: token } } });
    expect(page.data.motion).toEqual({});
  });

  test("an old animation completion cannot clear a new batch at the same index", async () => {
    const page = harness.open("/pages/collection/index?collection=muse");
    await respond(harness, page, harness.requests[0]!, collectionPage(["a", "b"], true));
    page.loadMore();
    await respond(harness, page, harness.requests[1]!, collectionPage(["old-c", "old-d"], true));
    const old = { ...page.data.motion[2] };
    page.selectCategory({ detail: { value: "1" } });
    await respond(harness, page, harness.requests[2]!, collectionPage(["x", "y"], true));
    page.loadMore();
    await respond(harness, page, harness.requests[3]!, collectionPage(["new-c", "new-d"], true));
    const current = { ...page.data.motion[2] };
    page.onEnterEnd({ currentTarget: { dataset: { index: 2, id: "old-c", motionToken: old.token } } });
    expect(page.data.motion[2]).toEqual(current);
    page.onEnterEnd({ currentTarget: { dataset: { index: 2, id: "new-c", motionToken: old.token } } });
    expect(page.data.motion[2]).toEqual(current);
    page.onEnterEnd({ currentTarget: { dataset: { index: 2, id: "new-c", motionToken: current.token } } });
    expect(page.data.motion[2]).toBeUndefined();
  });

  test("single appended row, initial load, refresh and filter reset never enter", async () => {
    const page = harness.open("/pages/collection/index?collection=layouts");
    await wait(() => harness.requests.length === 1);
    await respond(harness, page, harness.requests[0]!, collectionPage(["a", "b", "c"], true));
    expect(page.data.motion).toEqual({});
    page.browseAll();
    page.onReachBottom();
    await wait(() => harness.requests.length === 2);
    await respond(harness, page, harness.requests[1]!, collectionPage(["d"], true));
    expect(page.data.motion).toEqual({});
    page.onPullDownRefresh();
    await wait(() => harness.requests.length === 3);
    await respond(harness, page, harness.requests[2]!, collectionPage(["a", "b", "c"], true));
    expect(page.data.motion).toEqual({});
    page.selectCategory({ detail: { value: "1" } });
    await wait(() => harness.requests.length === 4);
    await respond(harness, page, harness.requests[3]!, collectionPage(["x", "y", "z"], false));
    expect(page.data.items.map((item: { id: string }) => item.id)).toEqual(["x", "y", "z"]);
    expect(page.data.motion).toEqual({});
  });

  test("the stored reduced-motion preference suppresses entrance and onShow re-reads it", async () => {
    harness.wx.setStorageSync("chenyuan.reduced-motion", true);
    const page = harness.open("/pages/collection/index?collection=muse");
    expect(page.data.reducedMotion).toBe(true);
    await wait(() => harness.requests.length === 1);
    await respond(harness, page, harness.requests[0]!, collectionPage(["a", "b"], true));
    page.onReachBottom();
    await wait(() => harness.requests.length === 2);
    await respond(harness, page, harness.requests[1]!, collectionPage(["c", "d", "e"], true));
    expect(page.data.items).toHaveLength(5);
    expect(page.data.motion).toEqual({});
    harness.wx.setStorageSync("chenyuan.reduced-motion", false);
    page.onShow();
    expect(page.data.reducedMotion).toBe(false);
  });

  test("onHide settles a pending entrance and a late result cannot replay it", async () => {
    const page = harness.open("/pages/collection/index?collection=muse");
    await wait(() => harness.requests.length === 1);
    await respond(harness, page, harness.requests[0]!, collectionPage(["a", "b"], true));
    page.onReachBottom();
    await wait(() => harness.requests.length === 2);
    page.onHide();
    harness.respond(harness.requests[1]!, collectionPage(["c", "d", "e"], true));
    await wait(() => page.data.items.length === 5);
    expect(page.data.motion).toEqual({});
    page.onReachBottom();
    await wait(() => harness.requests.length === 3);
    page.onUnload();
    harness.respond(harness.requests[2]!, collectionPage(["f", "g"], true));
    await tick();
    expect(page.data.motion).toEqual({});
  });
});
