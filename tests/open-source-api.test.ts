import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenSourceEntry } from "../lib/open-source-types";

type FakeRow = { content_json: string };

// 公共数据库是随部署打包的本地 sqlite；测试用假行模拟整表读取。
const fakeDb = {
  prepare: (_sql: string) => ({
    all: () => currentRows,
  }),
};
let currentRows: FakeRow[] = [];

vi.mock("../lib/public-database", () => ({
  getPublicDatabase: () => fakeDb,
}));

function makeEntry(index: number): OpenSourceEntry {
  return {
    category: "agents",
    caveats: [],
    dimensions: ["coding-agent"],
    evidence: {
      checkedAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      kind: "repository",
      label: "仓库核读",
      note: "核读记录。",
      url: "https://github.com/example/repo",
    },
    judgement: "值得跟踪。",
    nextStep: "继续观察。",
    personalNote: "个人判读。",
    repository: "example/repo",
    repositoryUrl: "https://github.com/example/repo",
    scenarios: ["场景"],
    slug: `repo-${index}`,
    sourceSummary: `仓库 ${index} 的摘要。`,
    status: "持续跟踪",
    type: "智能体",
    workflow: [],
  };
}

describe("open-source public API", () => {
  beforeEach(() => {
    currentRows = Array.from({ length: 25 }, (_, index) => ({
      content_json: JSON.stringify(makeEntry(index)),
    }));
  });

  it("slices the curated list into { hasMore, items } pages", async () => {
    const { getOpenSourcePage } = await import("../lib/open-source");

    const firstPage = await getOpenSourcePage(0, 20);
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.hasMore).toBe(true);

    const lastPage = await getOpenSourcePage(20, 20);
    expect(lastPage.items).toHaveLength(5);
    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.items.every((item) => item.slug.startsWith("repo-"))).toBe(true);
  });

  it("serves pages through the shared feed skeleton with cache headers", async () => {
    const { GET } = await import("../app/api/open-source/route");

    const response = await GET(new Request("http://localhost/api/open-source?offset=0&limit=20"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    const body = (await response.json()) as { hasMore: boolean; items: Array<{ slug: string }> };
    expect(body.hasMore).toBe(true);
    expect(body.items).toHaveLength(20);
    expect(body.items[0]?.slug).toBe("repo-0");
  });

  it("rejects invalid pagination params before touching sqlite", async () => {
    const { GET } = await import("../app/api/open-source/route");

    const response = await GET(new Request("http://localhost/api/open-source?limit=999"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "分页参数无效。" });
  });
});
