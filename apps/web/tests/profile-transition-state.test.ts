import { animate } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginProfileTransition, clearProfileTransition, readProfileTransition } from "@/components/profile-transition-state";

vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

type StorageFailureMode = "access" | "read" | "write" | "removal";

// 只破坏被测的单一存储环节，不整库 mock，保留各失败模式的独立性。
function stubStorageFailure(mode: StorageFailureMode) {
  if (mode === "access") {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    return;
  }
  const method = mode === "read" ? "getItem" : mode === "write" ? "setItem" : "removeItem";
  const exception = mode === "write"
    ? new DOMException("Storage full", "QuotaExceededError")
    : new DOMException("Storage denied", "SecurityError");
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw exception;
  });
}

// 聚合校验所有漂移动画均已停止：不绑定调用顺序与逐个次数，只排除“仍有动画在跑”的泄漏。
function expectEveryDriftStopped() {
  vi.mocked(animate).mock.results.forEach((result) => expect(result.value.stop).toHaveBeenCalled());
}

describe("beginProfileTransition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="curation-home__avatar"></div>
      <div class="curation-home__identity"></div>
      <div class="curation-home__external-links"><a href="https://github.com">GitHub</a><a href="https://www.yuque.com">语雀</a><button>关于我</button></div>
    `;
    document.body.querySelectorAll<HTMLElement>("div").forEach((element) => {
      element.getBoundingClientRect = vi.fn(() => new DOMRect(16, 16, 72, 72));
    });
    window.sessionStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 900px)",
    })));
  });

  afterEach(() => {
    clearProfileTransition();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stops discarded ghost animations on replacement and cleanup", () => {
    beginProfileTransition("home", "ask");
    beginProfileTransition("home", "daily");
    clearProfileTransition();

    expectEveryDriftStopped();
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
    expect(document.documentElement.dataset.profileTransition).toBeUndefined();
  });

  it.each(["access", "read"] as const)("returns no transition when storage %s throws", (failure) => {
    expect(beginProfileTransition("home", "ask")).toBe(true);
    stubStorageFailure(failure);

    expect(readProfileTransition()).toBeNull();
  });

  it.each(["access", "removal"] as const)("cleans up ghosts even when storage %s throws", (failure) => {
    expect(beginProfileTransition("home", "ask")).toBe(true);
    stubStorageFailure(failure);

    expect(() => clearProfileTransition()).not.toThrow();
    expectEveryDriftStopped();
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
    expect(document.documentElement.dataset.profileTransition).toBeUndefined();
  });

  it.each(["access", "write", "write-and-removal"] as const)("falls back without hidden content when storage %s fails", (failure) => {
    if (failure === "access") {
      stubStorageFailure("access");
    } else {
      stubStorageFailure("write");
      if (failure === "write-and-removal") stubStorageFailure("removal");
    }

    expect(beginProfileTransition("home", "ask")).toBe(false);

    expectEveryDriftStopped();
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
    expect(document.documentElement.dataset.profileTransition).toBeUndefined();
  });

  it("starts a transition when only storage removal fails", () => {
    stubStorageFailure("removal");

    expect(beginProfileTransition("home", "ask")).toBe(true);
    expect(readProfileTransition()?.kind).toBe("collapse");
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(3);
  });

  it.each(["height", "left", "top", "width"])("returns null when the links box %s is not a finite number", (field) => {
    window.sessionStorage.setItem(
      "site-profile-transition",
      JSON.stringify({
        avatar: { height: 10, left: 0, top: 0, width: 10 },
        kind: "collapse",
        links: { height: 10, left: 0, top: 0, width: 10, [field]: "10" },
        summary: { height: 10, left: 0, top: 0, width: 10 },
      }),
    );
    expect(readProfileTransition()).toBeNull();
  });

  it("returns null when a stored box value is missing, null, or overflows to Infinity", () => {
    const validPayload = JSON.stringify({
      avatar: { height: 10, left: 0, top: 0, width: 10 },
      kind: "collapse",
      links: { height: 10, left: 0, top: 0, width: 10 },
      summary: { height: 10, left: 0, top: 0, width: 10 },
    });
    window.sessionStorage.setItem("site-profile-transition", validPayload.replace('"links":{"height":10', '"links":{"height":1e999'));
    expect(readProfileTransition()).toBeNull();
    window.sessionStorage.setItem("site-profile-transition", validPayload.replace('"links":{"height":10', '"links":{"height":null'));
    expect(readProfileTransition()).toBeNull();
    window.sessionStorage.setItem(
      "site-profile-transition",
      validPayload.replace('"links":{"height":10,"left":0,"top":0,"width":10}', '"links":{"left":0,"top":0,"width":10}'),
    );
    expect(readProfileTransition()).toBeNull();
  });

  it("does not create flying ghosts when the header has scrolled out of view", () => {
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockReturnValue(new DOMRect(16, -100, 52, 52));
    expect(beginProfileTransition("daily", "home")).toBe(false);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
  });

  it("appends ghosts matching the measured source geometry and stores the transition payload", () => {
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    const summary = document.querySelector<HTMLElement>(".curation-home__identity")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 80, 80));
    vi.spyOn(summary, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 112, 240, 64));

    expect(beginProfileTransition("home", "ask")).toBe(true);

    // jsdom 不对行内定位做布局，ghost 的 getBoundingClientRect 恒为零；
    // 几何契约由行内样式与写入 sessionStorage 的载荷表达。
    const inlineBox = (selector: string) => {
      const ghost = document.querySelector<HTMLElement>(selector)!;
      return { height: ghost.style.height, left: ghost.style.left, top: ghost.style.top, width: ghost.style.width };
    };
    expect(inlineBox(".profile-transition-ghost--avatar")).toEqual({ height: "80px", left: "10px", top: "20px", width: "80px" });
    expect(inlineBox(".profile-transition-ghost--summary")).toEqual({ height: "64px", left: "12px", top: "112px", width: "240px" });
    expect(inlineBox(".profile-transition-ghost--links")).toEqual({ height: "72px", left: "16px", top: "16px", width: "72px" });

    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(3);
    ["avatar", "summary", "links"].forEach((variant) => {
      expect(document.querySelectorAll(`.profile-transition-ghost--${variant}`)).toHaveLength(1);
    });
    document.querySelectorAll<HTMLElement>(".profile-transition-ghost").forEach((ghost) => {
      expect(ghost.getAttribute("aria-hidden")).toBe("true");
      ghost.querySelectorAll("a, button").forEach((child) => {
        expect(child.getAttribute("tabindex")).toBe("-1");
      });
    });
    expect(document.querySelector(".profile-transition-ghost--links")?.textContent).toBe("GitHub语雀关于我");

    expect(JSON.parse(window.sessionStorage.getItem("site-profile-transition")!)).toEqual({
      avatar: { height: 80, left: 10, top: 20, width: 80 },
      kind: "collapse",
      links: { height: 72, left: 16, top: 16, width: 72 },
      summary: { height: 64, left: 12, top: 112, width: 240 },
    });

    clearProfileTransition();
    expectEveryDriftStopped();
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
  });
});
