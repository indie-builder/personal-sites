import { describe, expect, it, vi } from "vitest";

import { Route } from "../src/routes/opengraph-image";

// vitest 不经过 TanStack 的 vite 插件：server handlers 挂在 route options 上。
const GET = (Route.options.server?.handlers as { GET: () => Response | Promise<Response> }).GET;

describe("opengraph-image route", () => {
  it("renders the site share card as PNG from the bundled font without network access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled"));
    try {
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      const body = await response.arrayBuffer();
      expect(body.byteLength).toBeGreaterThan(0);
      const externalCalls = fetchSpy.mock.calls.filter(([input]) => /^https?:/u.test(String(input)));
      expect(externalCalls).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
