import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getCurationPage, getCurationTags } = await import("../lib/curation");
const { GET } = await import("../app/api/curation/route");

describe("curation topic filters", () => {
  it("counts the full X corpus and paginates within a tag", async () => {
    const tags = getCurationTags();
    expect(tags[0].tag).toBe("提示词");
    expect(tags[1].tag).toBe("技能");
    for (const { tag, count, headId } of tags.slice(0, 2)) {
      const full = await getCurationPage(0, 10_000, tag);
      expect(full.items).toHaveLength(count);
      expect(full.items[0].id).toBe(headId);
      expect(count).toBeGreaterThan(20);
      expect(full.items.every((item) => item.source.platform === "x" && item.tags.includes(tag))).toBe(true);
      const first = await getCurationPage(0, 20, tag);
      const second = await getCurationPage(20, 20, tag);
      expect(first.hasMore).toBe(true);
      expect([...first.items, ...second.items]).toEqual(full.items.slice(0, 40));
    }
  });

  it("filters the API before pagination and retains public cache headers", async () => {
    const response = await GET(new Request("http://localhost/api/curation?tag=%E6%8F%90%E7%A4%BA%E8%AF%8D&offset=20"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.json()).toEqual(await getCurationPage(20, 20, "提示词"));
    const unfiltered = await GET(new Request("http://localhost/api/curation"));
    expect(await unfiltered.json()).toEqual(await getCurationPage());
  });

  it("handles unknown tags as empty and validates untrusted input", async () => {
    expect(await getCurationPage(0, 20, "' OR 1=1 --")).toEqual({ hasMore: false, items: [] });
    for (const query of ["tag=", `tag=${"a".repeat(41)}`, "offset=-1", "tag=%E6%8F%90%E7%A4%BA%E8%AF%8D&limit=51"]) {
      expect((await GET(new Request(`http://localhost/api/curation?${query}`))).status).toBe(400);
    }
  });
});
