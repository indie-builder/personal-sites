import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createAppService } from "../scripts/e2e/app-service";
import { root } from "../scripts/e2e/package";
import { settled } from "../scripts/e2e/scenario";
import { item, page } from "./portfolio-fixture";

const built = existsSync(`${root}/dist/lib/runtime.js`);

type Request = ReturnType<typeof createAppService>["requests"][number];

describe("built native portfolio reading", () => {
  test.skipIf(!built)("reads adjacent loaded works in place, cancels old details and preserves filtered collection", async () => {
    const harness = createAppService();
    const paused: string[] = [];
    Object.assign(harness.wx, { createVideoContext: (id: string) => ({ pause() { paused.push(id); } }) });
    const take = async (id: string) => {
      const path = `/api/portfolio/layouts/${id}`;
      await settled(() => harness.requests.some((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path), `${path} request`);
      return harness.requests.find((request) => !request.aborted && !request.settled && new URL(request.options.url).pathname === path)!;
    };
    try {
      harness.loadAll();
      const collection = harness.open("/pages/collection/index?collection=layouts");
      await settled(() => harness.requests.length === 1, "layouts collection request");
      harness.respond(harness.requests[0]!, page(["initial"]));
      await settled(() => !collection.data.loading, "layouts collection data");
      collection.inputQuery({ detail: { value: "  留白  " } });
      collection.search();
      await settled(() => harness.requests.length === 2, "layouts search request");
      harness.respond(harness.requests[1]!, page(["a", "b", "c"], false));
      await settled(() => !collection.data.loading, "layouts search data");
      const before = structuredClone(collection.data);
      collection.openWork({ currentTarget: { dataset: { id: "b" } } });
      const reader = harness.stack.at(-1)!;
      expect(reader.data.readingIndex).toBe(1);
      expect(reader.data.readingCount).toBe(3);
      expect(reader.readingIds).toEqual(["a", "b", "c"]);
      const video = { id: "clip", kind: "video", url: "https://example.com/clip.mp4", poster: "", width: 1200, height: 800 };
      harness.respond(await take("b"), { item: { ...item("b"), media: [video] } });
      await settled(() => !reader.data.loading, "initial work data");
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
      await settled(() => !reader.data.loading, "previous work data");
      harness.respond(late, { item: item("c") });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(reader.data.item.id).toBe("b");
      expect(reader.data.workId).toBe("b");
      reader.previousWork();
      const first = await take("a");
      harness.respond(first, { error: "暂时不可用" }, 500);
      await settled(() => !reader.data.loading, "failed work data");
      expect(reader.data.error).toContain("重试");
      const atStart = harness.requests.length;
      reader.previousWork();
      expect(harness.requests).toHaveLength(atStart);
      reader.loadWork();
      harness.respond(await take("a"), { item: item("a") });
      await settled(() => !reader.data.loading, "retried work data");
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
      await settled(() => harness.requests.length === 1, "muse collection request");
      const ids = Array.from({ length: 1824 }, (_, index) => `work-${index}`);
      harness.respond(harness.requests[0]!, page(ids, false));
      await settled(() => !collection.data.loading, "muse collection data");
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
      await settled(() => harness.requests.length === 1, "layouts collection request");
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
        await settled(() => !collection.data.loading, `layouts page ${pageIndex + 1} data`);
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
        await settled(() => harness.requests.length === 1, "cold work request");
        harness.respond(harness.requests[0]!, { item: item("cold") });
        await settled(() => !reader.data.loading, "cold work data");
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

});
