import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiNewsDetailArticle, AiNewsDetailFallbackPainted } from "@/app/ai-news/[id]/detail-entrance";

const FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";

let frameCallbacks: FrameRequestCallback[] = [];

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const flushFrames = () => {
  const pending = frameCallbacks.splice(0);
  for (const callback of pending) callback(0);
};

describe("AiNewsDetailFallbackPainted marker", () => {
  it("records the navigation path after the fallback survives two animation frames", () => {
    render(<AiNewsDetailFallbackPainted />);
    flushFrames();
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
    flushFrames();
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBe("/ai-news/example-item");
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
  it("arms the resolved fade once when the marker matches this navigation", () => {
    window.sessionStorage.setItem(FALLBACK_PAINTED_KEY, "/ai-news/example-item");
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    const article = screen.getByText("正文").closest("article");
    expect(article?.classList.contains("ai-news-detail__article")).toBe(true);
    expect(article?.classList.contains("ai-news-detail__article--resolved")).toBe(true);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("renders instantly and still consumes a marker from another navigation", () => {
    window.sessionStorage.setItem(FALLBACK_PAINTED_KEY, "/ai-news/different-item");
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
    expect(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY)).toBeNull();
  });

  it("renders instantly without a marker", () => {
    render(<AiNewsDetailArticle contentId="example-item"><p>正文</p></AiNewsDetailArticle>);
    expect(screen.getByText("正文").closest("article")?.classList.contains("ai-news-detail__article--resolved")).toBe(false);
  });
});
