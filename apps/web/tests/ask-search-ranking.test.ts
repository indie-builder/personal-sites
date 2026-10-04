import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchAiNewsDocuments } from "@/lib/ai-news";
import { searchAskDocuments } from "@/lib/ask-search.server";
import { searchLocalAskDocuments } from "@/lib/curation-search.server";

vi.mock("@/lib/ai-news", () => ({ searchAiNewsDocuments: vi.fn() }));
vi.mock("@/lib/curation-search.server", () => ({ searchLocalAskDocuments: vi.fn() }));

const document = (id: string, score = 1) => ({
  content: id,
  id,
  publishedAt: null,
  score,
  scope: "daily" as const,
  section: null,
  sourceId: id,
  sourceUrl: `/curation/${id}`,
  title: id,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchAskDocuments ranking", () => {
  it("rewards documents found by both exact and fallback retrieval", async () => {
    vi.mocked(searchLocalAskDocuments).mockImplementation((query) => {
      if (query === "alpha beta") return [document("exact"), document("shared")];
      if (query === "alpha") return [document("shared"), document("fallback")];
      return [];
    });

    const results = await Effect.runPromise(searchAskDocuments("alpha beta", "daily"));
    expect(results.map(({ id }) => id)).toEqual(["shared", "exact", "fallback"]);
  });

  it("normalizes incompatible source scores by rank", async () => {
    vi.mocked(searchLocalAskDocuments).mockImplementation((_query, scope) =>
      scope === "daily" ? [document("localFirst", 1), document("localSecond", 1)] : [],
    );
    vi.mocked(searchAiNewsDocuments).mockReturnValue(
      Effect.succeed([document("remoteFirst", 1_000), document("remoteSecond", 999)]),
    );

    const results = await Effect.runPromise(searchAskDocuments("?", "all"));
    expect(results.map(({ id }) => id)).toEqual(["remoteFirst", "localFirst", "remoteSecond", "localSecond"]);
  });
});
