import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAppService, root } from "../scripts/e2e";

type Harness = ReturnType<typeof createAppService>;
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const detail = (id: string) => ({
  id, title: `作品 ${id}`, category: "", topic: "", author: "", text: "正文", sourceURL: "", thumbnail: "", media: [],
});
const collectionPage = (ids: string[]) => ({
  items: ids.map(id => ({ ...detail(id), sourceURL: "https://example.com/original", thumbnail: "", media: [] })),
  total: ids.length, hasMore: false, categories: [], topics: [], attribution: "",
});
const end = (id: string) => ({ currentTarget: { dataset: { id } } } as unknown as WechatMiniprogram.CustomEvent);

async function until(check: () => boolean) {
  for (let turn = 0; turn < 100; turn += 1) {
    if (check()) return;
    await settle();
  }
  throw new Error("work page did not settle");
}

// Open through the collection handoff so the page owns a real next/previous reading order.
async function openReader(harness: Harness, ids: string[]) {
  const collection = harness.open("/pages/collection/index?collection=layouts");
  await until(() => harness.requests.length === 1);
  harness.respond(harness.requests[0]!, collectionPage(ids));
  await until(() => collection.data.items.length === ids.length);
  collection.openWork({ currentTarget: { dataset: { id: ids[0] } } });
  const reader = harness.stack.at(-1)!;
  harness.respond(harness.requests.at(-1)!, { item: detail(ids[0]) });
  await until(() => !reader.data.loading && reader.data.item?.id === ids[0]);
  return reader;
}

describe("work content motion", () => {
  test("initial content keeps the vertical entrance; next and previous enter from opposite sides", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const page = await openReader(harness, ["one", "two", "three"]);
      expect(page.data.contentEntering).toBe(true);
      expect(page.data.entryDirection).toBe("");
      page.finishContentEntry(end("one"));
      expect(page.data.contentEntering).toBe(false);

      page.nextWork();
      harness.respond(harness.requests.at(-1)!, { item: detail("two") });
      await until(() => page.data.item?.id === "two");
      expect(page.data.contentEntering).toBe(true);
      expect(page.data.entryDirection).toBe("next");
      // A completion from a replaced node cannot settle the current entry.
      page.finishContentEntry(end("one"));
      expect(page.data.contentEntering).toBe(true);
      page.finishContentEntry(end("two"));
      expect(page.data.contentEntering).toBe(false);
      expect(page.data.entryDirection).toBe("");

      page.previousWork();
      harness.respond(harness.requests.at(-1)!, { item: detail("one") });
      await until(() => page.data.item?.id === "one");
      expect(page.data.contentEntering).toBe(true);
      expect(page.data.entryDirection).toBe("prev");
    } finally { harness.close(); }
  });

  test("rapid moves cancel the older request and its late response is ignored", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const page = await openReader(harness, ["one", "two", "three"]);
      page.finishContentEntry(end("one"));
      page.nextWork();
      const stale = harness.requests.at(-1)!;
      page.nextWork();
      const current = harness.requests.at(-1)!;
      expect(current).not.toBe(stale);
      expect(stale.aborted).toBe(true);
      harness.respond(stale, { item: detail("two") });
      await settle();
      expect(page.data.item).toBe(null);
      expect(page.data.loading).toBe(true);
      harness.respond(current, { item: detail("three") });
      await until(() => page.data.item?.id === "three");
      expect(page.data.entryDirection).toBe("next");
      expect(page.data.contentEntering).toBe(true);
    } finally { harness.close(); }
  });

  test("a response arriving while hidden settles statically and does not replay on show", async () => {
    const harness = createAppService();
    try {
      harness.loadAll();
      const page = await openReader(harness, ["one", "two"]);
      page.finishContentEntry(end("one"));
      page.nextWork();
      page.onHide();
      harness.respond(harness.requests.at(-1)!, { item: detail("two") });
      await until(() => page.data.item?.id === "two");
      expect(page.data.contentEntering).toBe(false);
      expect(page.data.entryDirection).toBe("");
      page.onShow();
      expect(page.data.contentEntering).toBe(false);
      expect(page.data.entryDirection).toBe("");
    } finally { harness.close(); }
  });

  test("refresh and the stored reduced-motion preference keep content static", async () => {
    const harness = createAppService();
    try {
      harness.wx.setStorageSync("chenyuan.reduced-motion", true);
      harness.loadAll();
      const page = await openReader(harness, ["one", "two"]);
      expect(page.data.reducedMotion).toBe(true);
      expect(page.data.contentEntering).toBe(false);
      page.nextWork();
      harness.respond(harness.requests.at(-1)!, { item: detail("two") });
      await until(() => page.data.item?.id === "two");
      expect(page.data.contentEntering).toBe(false);
      expect(page.data.entryDirection).toBe("");

      harness.wx.setStorageSync("chenyuan.reduced-motion", false);
      page.onShow();
      expect(page.data.reducedMotion).toBe(false);
      page.onPullDownRefresh();
      harness.respond(harness.requests.at(-1)!, { item: detail("two") });
      await until(() => !page.data.loading);
      expect(page.data.contentEntering).toBe(false);
      expect(page.data.entryDirection).toBe("");
    } finally { harness.close(); }
  });

  test("directional keyframes use 220ms and stay within the 16px spatial budget", () => {
    const styles = readFileSync(path.join(root, "src/pages/work/index.wxss"), "utf8");
    expect(styles).toContain("work-content-in 160ms");
    expect(styles).toContain("work-content-in-next 220ms var(--ease-out)");
    expect(styles).toContain("work-content-in-prev 220ms var(--ease-out)");
    expect(styles).toContain("translateX(16px)");
    expect(styles).toContain("translateX(-16px)");
    const template = readFileSync(path.join(root, "src/pages/work/index.wxml"), "utf8");
    expect(template).toContain("'motion-enter-' + entryDirection");
    expect(template).toContain('data-id="{{item.id}}"');
  });
});
