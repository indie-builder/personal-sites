import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { mockPlatform } from "./platform-fixture";
import { createFeed, detailFor, stashRow, takeRow, type FeedRow } from "../src/lib/content";
import { SITE_ORIGIN } from "../src/lib/platform";
import { curation, news } from "./content-fixtures";

let platform: ReturnType<typeof mockPlatform>;
beforeEach(() => { platform = mockPlatform(); });

describe("detail reader", () => {
  test("fetches cold news details, reports expired row-only links explicitly", async () => {
    const promise = Effect.runPromise(detailFor("ai-news", "中文 id"));
    expect(platform.latest().options.url).toContain(encodeURIComponent("中文 id"));
    platform.latest().success({ item: { ...news("中文 id"), reason: "理由", url: "https://example.com/original" } });
    const detail = await promise;
    expect(detail.reason).toBe("理由");
    expect(detail.meta).toContain("精选");
    expect(detail.websiteUrl).toBe(`${SITE_ORIGIN}/ai-news/${encodeURIComponent("中文 id")}`);
    const plain = Effect.runPromise(detailFor("ai-news", "plain"));
    platform.latest().success({ item: { ...news("plain"), selected: false, reason: "", url: "https://example.com/original" } });
    expect((await plain).meta).not.toContain("精选");
    const expired = await Effect.runPromise(detailFor("curation", "no-carrier").pipe(Effect.flip));
    expect(expired.message).toContain("已失效");
  });

  test("maps curation routes and validates X video proxy destinations", async () => {
    const row: FeedRow = { id: "1", title: "设计标题", summary: "导读", meta: "作者", date: "2026-10-18", thumbnail: "", raw: curation("1") };
    const detail = await Effect.runPromise(detailFor("design", "1", row));
    expect(detail.websiteUrl).toBe(`${SITE_ORIGIN}/design/1`);
    expect(detail.media[0]?.videoUrl).toBe(`${SITE_ORIGIN}/api/x-media?url=${encodeURIComponent(curation("1").media[0]?.videoUrl ?? "")}`);
    expect(detail.media[0]?.width).toBe(720);
    expect(detail.media[0]?.height).toBe(1280);
    expect(detail.reason).toBe("设计理由");
    const raw = curation("1");
    const firstMedia = raw.media[0];
    if (!firstMedia) throw new Error("Missing media fixture");
    firstMedia.videoUrl = "https://evil.com/video.mp4";
    const invalid = await Effect.runPromise(detailFor("curation", "1", { ...row, raw }));
    expect(invalid.media[0]?.videoUrl).toBe("");
    expect((await Effect.runPromise(detailFor("douyin", "1", row))).websiteUrl).toBe(`${SITE_ORIGIN}/douyin/1`);
  });

  test("bounds the route carrier to latest twenty entries", () => {
    for (let index = 0; index < 21; index++) stashRow("curation", { id: `carrier-${index}`, title: "", summary: "", meta: "", date: "", thumbnail: "", raw: {} });
    expect(takeRow("curation", "carrier-0")).toBeUndefined();
    expect(takeRow("curation", "carrier-20")?.id).toBe("carrier-20");
  });

  test("maps open-source dimensions to the iOS Chinese labels in rows and tags", async () => {
    const feed = createFeed("open-source", () => {});
    const operation = Effect.runPromise(feed.load());
    platform.latest().success({ items: [{
      slug: "repo", repository: "owner/repo", sourceSummary: "判读", checkedAt: "2026-10-18", status: "活跃", type: "工具",
      dimensions: ["agent-skills", "agent-infra", "unmapped"],
    }], hasMore: false });
    await operation;
    expect(feed.state.items[0]?.meta).toBe("活跃 · 工具 · Agent Skills · Agent 基础设施 · unmapped");
    expect(feed.state.items[0]?.meta).not.toContain("agent-skills");
    const row = feed.state.items[0];
    if (!row) throw new Error("Missing open-source row");
    const detail = await Effect.runPromise(detailFor("open-source", "repo", row));
    expect(detail.tags).toEqual(["Agent Skills", "Agent 基础设施", "unmapped"]);
    expect(detail.sourceUrl).toBe("https://github.com/owner/repo");
  });

  test("accepts media without optional dimensions and maps missing values to null", async () => {
    const raw = curation("no-size");
    const media = raw.media[0];
    if (!media) throw new Error("Missing media fixture");
    const sized = { ...media } as Record<string, unknown>;
    delete sized.width;
    delete sized.height;
    raw.media = [sized as typeof media];
    const row: FeedRow = { id: "no-size", title: "", summary: "", meta: "", date: "", thumbnail: "", raw };
    const detail = await Effect.runPromise(detailFor("curation", "no-size", row));
    expect(detail.media[0]?.width).toBeNull();
    expect(detail.media[0]?.height).toBeNull();
  });
});
