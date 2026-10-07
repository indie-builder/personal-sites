import { Effect } from "effect";
import { io } from "@site/effect";
const MEDIA_HOST = "video.twimg.com";
const VIDEO_PATH = /^\/(?:amplify_video|ext_tw_video)\/.*\.mp4$/u;
const FORWARDED_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];
// 超时只覆盖"发起请求到响应头返回"：视频体随后长时间流式传输是正常情况，
// 不能被固定时限掐断。
const UPSTREAM_TIMEOUT_MS = 15_000;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function fetchUpstreamOnce(url: URL, headers: Headers, method: "GET" | "HEAD", requestSignal: AbortSignal) {
  return io("x-media.headers", (signal) => fetch(url, {
    headers, method, redirect: "manual", signal: AbortSignal.any([requestSignal, signal]),
  })).pipe(
    Effect.timeoutOrElse({ duration: UPSTREAM_TIMEOUT_MS, orElse: () => Effect.fail(new Error("视频源响应头超时。")) }),
  );
}

function getMediaUrl(request: Request): URL | null {
  const value = new URL(request.url).searchParams.get("url");
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === MEDIA_HOST && VIDEO_PATH.test(url.pathname) ? url : null;
  } catch {
    return null;
  }
}

// 重定向目标只允许留在 twimg CDN 域内：手动跟随一跳并逐跳校验，
// 否则上游一次 302 就能把本端点变成任意外站的开放代理。
function getRedirectUrl(location: string | null, base: URL): URL | null {
  if (!location) return null;
  try {
    const url = new URL(location, base);
    const isTwimgHost = url.hostname === MEDIA_HOST || url.hostname.endsWith(".twimg.com");
    return url.protocol === "https:" && isTwimgHost ? url : null;
  } catch {
    return null;
  }
}

function fetchUpstream(mediaUrl: URL, headers: Headers, method: "GET" | "HEAD", signal: AbortSignal) {
  return Effect.gen(function* () {
    const first = yield* fetchUpstreamOnce(mediaUrl, headers, method, signal);
    if (first.status < 300 || first.status >= 400) return first;

    const target = getRedirectUrl(first.headers.get("location"), mediaUrl);
    yield* io("x-media.discard-redirect", () => first.body?.cancel() ?? Promise.resolve());
    if (!target) return null;
    const second = yield* fetchUpstreamOnce(target, headers, method, signal);
    // 第二跳仍是重定向则不再跟随，避免被多跳链带出 CDN 域。
    if (second.status >= 300 && second.status < 400) {
      yield* io("x-media.discard-redirect", () => second.body?.cancel() ?? Promise.resolve());
      return null;
    }
    return second;
  });
}

async function proxyMedia(request: Request, method: "GET" | "HEAD") {
  const mediaUrl = getMediaUrl(request);
  if (!mediaUrl) return jsonError("不支持的视频地址。", 400);

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  let upstream: Response | null;
  try {
    upstream = await Effect.runPromise(fetchUpstream(mediaUrl, headers, method, request.signal), { signal: request.signal });
  } catch {
    // twimg DNS/连接抖动或响应头超时：与站内其他端点一致返回 JSON，不落 HTML 500。
    return jsonError("视频源暂时无法连接。", 502);
  }
  if (!upstream) return jsonError("视频地址的重定向目标不受支持。", 502);
  const responseHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  // 让 CDN 缓存视频分段（含 Range 206），浏览器侧保持轻缓存；上游错误不缓存。
  if (upstream.status >= 200 && upstream.status < 300) {
    responseHeaders.set("cache-control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
  }
  responseHeaders.set("x-content-type-options", "nosniff");

  return new Response(method === "HEAD" ? null : upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}

export function GET(request: Request) {
  return proxyMedia(request, "GET");
}

export function HEAD(request: Request) {
  return proxyMedia(request, "HEAD");
}
