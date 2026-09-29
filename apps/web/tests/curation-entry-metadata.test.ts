import { describe, expect, it, vi } from "vitest";

// lib/curation 顶部 import "server-only" 只面向 RSC 边界；测试里替换为空实现。
vi.mock("server-only", () => ({}));

const { getCurationPage, getDesignCurationPage } = await import("../lib/curation");
const { getCurationEntryMetadata } = await import("../components/curation-entry");

// 集成测试直接读随仓库打包的公开投影 data/curation.sqlite，
// 验证详情元数据的 canonical 归一与分享卡片字段。
describe("getCurationEntryMetadata", () => {
  it("每日关注详情 canonical 指向 /curation/<id> 并带完整分享卡片", async () => {
    const { items } = await getCurationPage(0, 1);
    const item = items[0];
    const metadata = await getCurationEntryMetadata(item.id, "curation");
    const canonicalPath = `/curation/${item.id}`;

    expect(metadata.alternates?.canonical).toBe(canonicalPath);
    // 浅合并语义下 alternates 需要保留布局层的 RSS types。
    expect(metadata.alternates?.types).toEqual({ "application/rss+xml": "/feed.xml" });
    expect(metadata.title).toBe(`${item.title}｜每日关注`);
    expect(metadata.description).toBe(item.summary);
    expect(metadata.openGraph).toMatchObject({
      description: item.summary,
      images: [{ url: "/opengraph-image" }],
      title: `${item.title}｜每日关注`,
      type: "article",
      url: canonicalPath,
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: `${item.title}｜每日关注` });
  });

  it("设计收藏详情 canonical 同样归一到 /curation/<id>", async () => {
    const { items } = await getDesignCurationPage(0, 1);
    expect(items.length, "投影中应存在设计收录条目").toBeGreaterThan(0);
    const designItem = items[0];

    const metadata = await getCurationEntryMetadata(designItem.id, "design");
    expect(metadata.alternates?.canonical).toBe(`/curation/${designItem.id}`);
    expect(metadata.title).toBe(`${designItem.title}｜设计收藏`);
    expect(metadata.openGraph?.url).toBe(`/curation/${designItem.id}`);
    expect(metadata.openGraph?.images).toEqual([expect.objectContaining({ url: "/opengraph-image" })]);
  });

  it("未收录设计的条目在设计路径下不产出元数据", async () => {
    const { items } = await getCurationPage(0, 50);
    const plainItem = items.find((entry) => entry.design?.status !== "include");
    expect(plainItem, "投影中应存在非设计收录条目").toBeTruthy();

    expect(await getCurationEntryMetadata(plainItem!.id, "design")).toEqual({});
    expect(await getCurationEntryMetadata("missing-entry-id", "curation")).toEqual({});
  });
});
