import { describe, expect, it } from "vitest";

import { aiNewsStreamSnapshot, curationStreamSnapshot } from "../components/stream-snapshot";
import type { CurationListItem } from "../lib/curation-types";

// 工厂语义（头部一致、TTL、条数上限、容错）对两套快照实例各跑一遍。
interface SnapshotCase {
  extra: Record<string, unknown>;
  name: string;
  sampleItem: { id: string } & Record<string, unknown>;
  snapshot: {
    from(raw: string | null, headId: string | undefined, now?: number): { items: unknown[] } | null;
    to(state: Record<string, unknown>, now?: number): object;
  };
}

const cases: SnapshotCase[] = [
  {
    name: "ai news",
    snapshot: aiNewsStreamSnapshot,
    sampleItem: {
      category: "ai-models",
      id: "cmssv94cg0h4mroffsb9e7a88",
      publishedAt: "2026-08-14T11:25:29.000Z",
      selected: true,
      sourceName: "公众号：小红书技术（dots.llm）",
      summary: "小红书技术开源 dots3-note Preview。",
      title: "dots3-note Preview 开源",
    },
    extra: { activeCategory: "selected" },
  },
  {
    name: "curation",
    snapshot: curationStreamSnapshot,
    sampleItem: {
      attachments: [],
      author: { handle: "someone", name: "Someone" },
      collectedAt: "2026-08-14T11:25:29.000Z",
      design: null,
      id: "tweet-1",
      media: [],
      publishedAt: "2026-08-14T11:25:29.000Z",
      source: { label: "X 原文", platform: "x", url: "https://x.com/someone/status/1" },
      summary: "一条策展判断。",
      tags: ["智能体"],
      text: "原推正文。",
      title: "策展标题",
    } satisfies CurationListItem,
    extra: {},
  },
];

describe("stream snapshot factory", () => {
  for (const { name, snapshot, sampleItem, extra } of cases) {
    const serialize = (itemCount: number, overrides: Record<string, unknown> = {}) => {
      const items = Array.from({ length: itemCount }, (_, index) => ({
        ...sampleItem,
        id: index === 0 ? sampleItem.id : `item-${index}`,
      }));
      return JSON.stringify(snapshot.to({ ...extra, hasMore: true, items, scrollTop: 0, ...overrides }));
    };

    it(`[${name}] round-trips items and pagination state`, () => {
      const restored = snapshot.from(serialize(3, { hasMore: false, scrollTop: 640 }), sampleItem.id);
      expect(restored).toMatchObject({ ...extra, hasMore: false, scrollTop: 640 });
      expect(restored?.items).toHaveLength(3);
    });

    it(`[${name}] rejects snapshots whose head no longer matches the SSR head`, () => {
      expect(snapshot.from(serialize(2), "a-newer-item-id")).toBeNull();
    });

    it(`[${name}] rejects expired snapshots`, () => {
      const savedAt = 1_000_000;
      const raw = JSON.stringify(snapshot.to({ ...extra, hasMore: true, items: [sampleItem], scrollTop: 0 }, savedAt));
      expect(snapshot.from(raw, sampleItem.id, savedAt + 29 * 60 * 1000)).not.toBeNull();
      expect(snapshot.from(raw, sampleItem.id, savedAt + 31 * 60 * 1000)).toBeNull();
    });

    it(`[${name}] caps stored items to bound sessionStorage size`, () => {
      expect(snapshot.from(serialize(500), sampleItem.id)?.items).toHaveLength(400);
    });

    it(`[${name}] rejects missing, malformed or empty snapshots`, () => {
      expect(snapshot.from(null, sampleItem.id)).toBeNull();
      expect(snapshot.from("not-json", sampleItem.id)).toBeNull();
      expect(snapshot.from(JSON.stringify({ items: [] }), sampleItem.id)).toBeNull();
      expect(snapshot.from(serialize(1), undefined)).toBeNull();
    });
  }
});
