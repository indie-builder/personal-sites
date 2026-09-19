import { describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/x-media/route";

const videoUrl = "https://video.twimg.com/amplify_video/1/vid/avc1/1280x720/video.mp4?tag=1";

describe("x-media route", () => {
  it("proxies an allowed X MP4 and preserves range playback headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("video-bytes", {
        headers: {
          "accept-ranges": "bytes",
          "content-range": "bytes 0-9/10",
          "content-type": "video/mp4",
        },
        status: 206,
      }),
    );
    const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`, {
      headers: { range: "bytes=0-9" },
    });

    const response = await GET(request);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 0-9/10");
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      headers: expect.any(Headers),
      method: "GET",
    }));
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toHaveProperty("get");
    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get("range")).toBe("bytes=0-9");
    fetchMock.mockRestore();
  });

  it("rejects any URL outside the allowlisted X video CDN with a JSON body", async () => {
    const response = await GET(new Request("http://localhost/api/x-media?url=https%3A%2F%2Fexample.com%2Ffile.mp4"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "不支持的视频地址。" });
  });
});

describe("x-media route error contract", () => {
  it("follows a single redirect that stays on the twimg CDN", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://video.twimg.com/amplify_video/1/vid/avc1/1280x720/video.mp4" } }))
      .mockResolvedValueOnce(new Response("video-bytes", { headers: { "content-type": "video/mp4" }, status: 200 }));
    const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("rejects redirects leaving the twimg CDN with a JSON 502", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://evil.example.com/file.mp4" } }),
    );
    const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`);

    const response = await GET(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "视频地址的重定向目标不受支持。" });
    fetchMock.mockRestore();
  });

  it("returns a JSON 502 when the upstream connection fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`);

    const response = await GET(request);

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "视频源暂时无法连接。" });
    fetchMock.mockRestore();
  });

  it("returns a JSON 502 when upstream headers do not arrive before the timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      );
      const request = new Request(`http://localhost/api/x-media?url=${encodeURIComponent(videoUrl)}`);
      const pending = GET(request);

      await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending;

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "视频源暂时无法连接。" });
      fetchMock.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the same JSON error contract for HEAD requests", async () => {
    const { HEAD } = await import("../app/api/x-media/route");
    const response = await HEAD(new Request("http://localhost/api/x-media?url=https%3A%2F%2Fexample.com%2Ffile.mp4"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "不支持的视频地址。" });
  });
});
