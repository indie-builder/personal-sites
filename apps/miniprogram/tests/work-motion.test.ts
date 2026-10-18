import { describe, expect, test } from "bun:test";
import { createAppService } from "../scripts/e2e";
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const item = { id: "one", title: "作品", category: "", topic: "", author: "", text: "正文", sourceURL: "", thumbnail: "", media: [] };

describe("work content motion", () => {
  test("new work settles after animation; refresh and hiding do not replay the entrance", async () => {
    const h = createAppService();
    try {
      h.loadAll();
      const page = h.open("/pages/work/index?collection=layouts&id=one");
      h.respond(h.requests.at(-1)!, { item }); await settle();
      expect(page.data.contentEntering).toBe(true);
      page.finishContentEntry();
      expect(page.data.contentEntering).toBe(false);
      page.onPullDownRefresh();
      h.respond(h.requests.at(-1)!, { item }); await settle();
      expect(page.data.contentEntering).toBe(false);
      page.onHide(); expect(page.data.contentEntering).toBe(false);
    } finally { h.close(); }
  });

  test("a response arriving while hidden settles without arming an entrance", async () => {
    const h = createAppService();
    try {
      h.loadAll();
      const page = h.open("/pages/work/index?collection=layouts&id=one");
      page.onHide();
      h.respond(h.requests.at(-1)!, { item }); await settle();
      expect(page.data.contentEntering).toBe(false);
      page.onShow(); expect(page.data.contentEntering).toBe(false);
    } finally { h.close(); }
  });

  test("the stored reduced-motion preference keeps new works static", async () => {
    const h = createAppService();
    try {
      h.wx.setStorageSync("chenyuan.reduced-motion", true);
      h.loadAll();
      const page = h.open("/pages/work/index?collection=layouts&id=one");
      h.respond(h.requests.at(-1)!, { item }); await settle();
      expect(page.data.reducedMotion).toBe(true);
      expect(page.data.contentEntering).toBe(false);
    } finally { h.close(); }
  });
});
