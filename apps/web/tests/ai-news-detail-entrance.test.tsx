import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiNewsDetailArticle, AiNewsDetailFallbackPainted } from "@/app/ai-news/[id]/detail-entrance";

const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";
const FRESH_MS = 3000;

let frameCallbacks: FrameRequestCallback[] = [];
let now = 1_000_000;

beforeEach(() => {
  window.history.replaceState(null, "", "/ai-news/example-item");
  window.sessionStorage.removeItem(FALLBACK_PAINTED_KEY);
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    frameCallbacks.splice(handle - 1, 1);
  });
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

const flushFrames = () => {
  const pending = frameCallbacks.splice(0);
  for (const callback of pending) callback(0);
};

const readMarker = () => {
  const raw = window.sessionStorage.getItem(FALLBACK_PAINTED_KEY);
  return raw === null ? null : (JSON.parse(raw) as { at: number; path: string; entryId: string | null });
};

const seedMarker = (at: number, path: string) => {
  window.sessionStorage.setItem(FALLBACK_PAINTED_KEY, JSON.stringify({ at, path }));
};

let navigationEntryId = "e1";
const navigationStub = {
  get currentEntry() {
    return { id: navigationEntryId };
  },
};

describe("AiNewsDetailFallbackPainted marker", () => {
  it("records the navigation path and time after the fallback survives two animation frames", () => {
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    expect(readMarker()).toBeNull();
    now += 50;
    flushFrames();
    expect(readMarker()).toEqual({ at: 1_000_050, path: "/ai-news/example-item", entryId: null });
  });

  it("leaves no marker when content replaces the fallback before the second frame", () => {
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    cleanup();
    flushFrames();
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });
});

describe("AiNewsDetailArticle entrance arming", () => {
  it("arms the resolved fade when the marker belongs to a fresh navigation", () => {
    seedMarker(now - 500, "/ai-news/example-item");
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    const article = screen.getByText("正文").closest("article");
    expect(article?.classList.contains("ai-news-detail__article")).toBe(true);
    expect(article?.classList.contains("ai-news-detail__article--resolved")).toBe(true);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("does not fade when the marker is consumed only after the TTL expires", () => {
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    flushFrames();
    expect(readMarker()?.path).toBe("/ai-news/example-item");
    now += FRESH_MS + 1_000;
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("does not fade when an abandoned navigation is revisited within the TTL under a new entry", () => {
    navigationEntryId = "e1";
    vi.stubGlobal("navigation", navigationStub);
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    flushFrames();
    expect(readMarker()).toEqual({ at: now, path: "/ai-news/example-item", entryId: "e1" });
    navigationEntryId = "e2";
    now += 500;
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("arms within the TTL when the marker and article share one navigation entry", () => {
    navigationEntryId = "e1";
    vi.stubGlobal("navigation", navigationStub);
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    flushFrames();
    now += 500;
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(true);
  });

  it("renders instantly and still consumes a marker from another navigation", () => {
    seedMarker(now - 500, "/ai-news/different-item");
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("renders instantly without a marker", () => {
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
  });
});
