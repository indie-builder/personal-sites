import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getCurationPage, getCurationTags } = await import("../lib/curation");
const { GET } = await import("../app/api/curation/route");

describe("curation topic filters", () => {
  it("counts the full X corpus and paginates within a tag", async () => {
    const tags = await Effect.runPromise(getCurationTags());
    expect(tags[0].tag).toBe("提示词");
    expect(tags.slice(0, 9).map(({ tag }) => tag)).toEqual([
      "提示词",
      "视频提示词",
      "软件工程提示词",
      "图像提示词",
      "写作提示词",
      "学习提示词",
      "研究提示词",
      "助手提示词",
      "技能",
    ]);
    for (const { tag, count, headId } of tags.slice(0, 9)) {
      const full = await Effect.runPromise(getCurationPage(0, 10_000, tag));
      expect(full.items).toHaveLength(count);
      expect(full.items[0].id).toBe(headId);
      expect(count).toBeGreaterThan(0);
      expect(full.items.every((item) => item.source.platform === "x" && item.tags.includes(tag))).toBe(true);
      if (tag !== "提示词" && tag.endsWith("提示词")) {
        expect(full.items.every((item) => item.tags.includes("提示词"))).toBe(true);
      }
      const first = await Effect.runPromise(getCurationPage(0, 20, tag));
      const second = await Effect.runPromise(getCurationPage(20, 20, tag));
      expect(first.hasMore).toBe(count > 20);
      expect([...first.items, ...second.items]).toEqual(full.items.slice(0, 40));
    }
  });

  it("classifies prompts by purpose rather than the coding tool or attachment", async () => {
    const parent = await Effect.runPromise(getCurationPage(0, 10_000, "提示词"));
    const ids = new Set(parent.items.map((item) => item.id));
    const classified = new Set(
      parent.items
        .filter((item) => item.tags.some((tag) => tag !== "提示词" && tag.endsWith("提示词")))
        .map((item) => item.id),
    );
    expect(classified).toEqual(ids);
    const animation = parent.items.find((item) => item.id === "2104846047256469948")!;
    expect(animation.tags).toContain("视频提示词");
    expect(animation.tags).not.toContain("软件工程提示词");
    expect(parent.items.find((item) => item.id === "2098003579449794570")!.tags).toContain("图像提示词");
    expect(parent.items.find((item) => item.id === "2075959048432984123")!.tags).toContain("学习提示词");
    expect(parent.items.find((item) => item.id === "2093838678565286324")!.tags).toContain("助手提示词");
  });

  it("filters the API before pagination and retains public cache headers", async () => {
    const response = await GET(new Request("http://localhost/api/curation?tag=%E6%8F%90%E7%A4%BA%E8%AF%8D&offset=20"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.json()).toEqual(await Effect.runPromise(getCurationPage(20, 20, "提示词")));
    const unfiltered = await GET(new Request("http://localhost/api/curation"));
    expect(await unfiltered.json()).toEqual(await Effect.runPromise(getCurationPage()));
  });

  it("handles unknown tags as empty and validates untrusted input", async () => {
    expect(await Effect.runPromise(getCurationPage(0, 20, "' OR 1=1 --"))).toEqual({ hasMore: false, items: [] });
    for (const query of ["tag=", `tag=${"a".repeat(41)}`, "offset=-1", "tag=%E6%8F%90%E7%A4%BA%E8%AF%8D&limit=51"]) {
      expect((await GET(new Request(`http://localhost/api/curation?${query}`))).status).toBe(400);
    }
  });
});
