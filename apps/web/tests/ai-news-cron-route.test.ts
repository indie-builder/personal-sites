import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ai-news-sync.server", () => ({
  authorizeAiNewsCron: vi.fn(),
  runAiNewsCron: vi.fn(),
}));

const syncModule = await import("../lib/ai-news-sync.server");
const { POST } = await import("../app/api/cron/ai-news/route");

const authorizeMock = vi.mocked(syncModule.authorizeAiNewsCron);
const runMock = vi.mocked(syncModule.runAiNewsCron);

describe("AI news Cron routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without the Vault-backed bearer token", async () => {
    authorizeMock.mockReturnValue(Effect.succeed(false));
    const response = await POST(new Request("https://example.com/api/cron/ai-news", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("runs an authorized incremental sync without caching", async () => {
    authorizeMock.mockReturnValue(Effect.succeed(true));
    runMock.mockReturnValue(
      Effect.succeed({
        backfill: false,
        modes: {},
        publicCount: 0,
        skipped: false,
      }),
    );
    const response = await POST(
      new Request("https://example.com/api/cron/ai-news", {
        body: JSON.stringify({ backfill: false }),
        headers: {
          authorization: "Bearer cron-secret",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(runMock).toHaveBeenCalledWith(false);
  });

});
