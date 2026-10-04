// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const health = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase.server", () => ({ getAdminSupabaseClient: () => ({}) }));
vi.mock("@site/public-data/ai-news/state.mjs", () => ({ createSupabaseAiNewsStateStore: () => ({ health }) }));
vi.mock("@/lib/public-database", () => ({ getPublicDatabase: () => ({}) }));
vi.mock("@site/public-data/data-health/sqlite.mjs", () => ({
  readPublicDataHealth: () => ({
    askDocuments: 1, askFts: 1, askMissingFts: 0, askOrphanFts: 0, quickCheck: "ok",
    curation: {
      x: { count: 1, latestAt: new Date().toISOString() },
      douyin: { count: 1, latestAt: new Date().toISOString() },
    },
    openSource: { count: 1, latestAt: new Date().toISOString() },
  }),
}));

const { GET } = await import("@/app/api/health/data/route");

describe("unified data health", () => {
  beforeEach(() => health.mockReset());

  it.each([true, false])("reports AI news health %s without exposing internal synchronization errors", async (healthy) => {
    health.mockReturnValue(Effect.succeed({
      ageMinutes: healthy ? 1 : 25,
      healthy,
      lastError: "database connection failed with internal details",
      lastStartedAt: null,
      lastSucceededAt: new Date().toISOString(),
      running: false,
    }));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(healthy ? 200 : 503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({ healthy, aiNews: { healthy, ageMinutes: healthy ? 1 : 25 } });
    expect(body.aiNews).not.toHaveProperty("lastError");
    expect(JSON.stringify(body)).not.toContain("internal details");
  });

  it("returns only public failure state when health cannot be read", async () => {
    health.mockReturnValue(Effect.fail(new Error("internal details")));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ healthy: false });
  });
});
