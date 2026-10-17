// @vitest-environment node
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

// 单条内容读取不再有请求内记忆化：每次调用各自读一次库，结果由只读投影决定，重复读幂等。
// 计数断言锚定「没有请求级缓存层」，防止再引入一层假的请求记忆化。
const reads: string[] = [];
vi.mock("../lib/public-database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-database")>();
  return {
    ...actual,
    getPublicDatabase: () => {
      reads.push("read");
      return actual.getPublicDatabase();
    },
  };
});

const { getPublicDatabase } = await import("../lib/public-database");
const { findCurationItem } = await import("../lib/curation");
const { getOpenSourceEntry } = await import("../lib/open-source");

const curationIdRow = Schema.Struct({ id: Schema.String });
const openSourceSlugRow = Schema.Struct({ slug: Schema.String });
const curationId = Schema.decodeUnknownSync(curationIdRow)(
  getPublicDatabase().prepare("SELECT id FROM curation_items LIMIT 1").get(),
).id;
const openSourceSlug = Schema.decodeUnknownSync(openSourceSlugRow)(
  getPublicDatabase().prepare("SELECT slug FROM open_source_items LIMIT 1").get(),
).slug;

describe("内容单条读取", () => {
  it("剪报条目两次读取各自读库，返回同一投影内容", async () => {
    reads.length = 0;
    const [a, b] = await Promise.all([
      Effect.runPromise(findCurationItem(curationId)),
      Effect.runPromise(findCurationItem(curationId)),
    ]);
    expect(a).toMatchObject({ id: curationId });
    expect(a).toEqual(b);
    expect(reads).toHaveLength(2);
  });

  it("开源条目两次读取各自读库，返回同一投影内容", async () => {
    reads.length = 0;
    const [a, b] = await Promise.all([
      Effect.runPromise(getOpenSourceEntry(openSourceSlug)),
      Effect.runPromise(getOpenSourceEntry(openSourceSlug)),
    ]);
    expect(a).toMatchObject({ slug: openSourceSlug });
    expect(a).toEqual(b);
    expect(reads).toHaveLength(2);
  });
});
