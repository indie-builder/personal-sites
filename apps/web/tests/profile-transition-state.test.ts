import { animate } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginProfileTransition, clearProfileTransition, readProfileTransition } from "@/components/profile-transition-state";

vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

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
    const first = vi.mocked(animate).mock.results.slice(-3).map(result => result.value);
    beginProfileTransition("home", "daily");
    first.forEach(controls => expect(controls.stop).toHaveBeenCalledOnce());
    const second = vi.mocked(animate).mock.results.slice(-3).map(result => result.value);
    clearProfileTransition();
    second.forEach(controls => expect(controls.stop).toHaveBeenCalledOnce());
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
  });

  it.each(["access", "read"])("returns no transition when storage %s throws", (failure) => {
    expect(beginProfileTransition("home", "ask")).toBe(true);
    if (failure === "access") {
      vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
        throw new DOMException("Storage denied", "SecurityError");
      });
    } else {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("Storage denied", "SecurityError");
      });
    }

    expect(readProfileTransition()).toBeNull();
  });

  it.each(["access", "removal"])("cleans up ghosts even when storage %s throws", (failure) => {
    expect(beginProfileTransition("home", "ask")).toBe(true);
    const controls = vi.mocked(animate).mock.results.slice(-3).map(result => result.value);
    if (failure === "access") {
      vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
        throw new DOMException("Storage denied", "SecurityError");
      });
    } else {
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new DOMException("Storage denied", "SecurityError");
      });
    }

    expect(() => clearProfileTransition()).not.toThrow();
    controls.forEach(control => expect(control.stop).toHaveBeenCalledOnce());
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
    expect(document.documentElement.dataset.profileTransition).toBeUndefined();
  });

  it.each(["access", "write", "write-and-removal"])("falls back without hidden content when storage %s fails", (failure) => {
    if (failure === "access") {
      vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
        throw new DOMException("Storage denied", "SecurityError");
      });
    } else {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Storage full", "QuotaExceededError");
      });
      if (failure === "write-and-removal") {
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
          throw new DOMException("Storage denied", "SecurityError");
        });
      }
    }
    const previousAnimationCount = vi.mocked(animate).mock.results.length;

    expect(beginProfileTransition("home", "ask")).toBe(false);

    const controls = vi.mocked(animate).mock.results.slice(previousAnimationCount).map(result => result.value);
    expect(controls).toHaveLength(3);
    controls.forEach(control => expect(control.stop).toHaveBeenCalledOnce());
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
    expect(document.documentElement.dataset.profileTransition).toBeUndefined();
  });

  it("starts a transition when only storage removal fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    expect(beginProfileTransition("home", "ask")).toBe(true);
    expect(readProfileTransition()?.kind).toBe("collapse");
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(3);
  });

  it("does not create flying ghosts when the header has scrolled out of view", () => {
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockReturnValue(new DOMRect(16, -100, 52, 52));
    expect(beginProfileTransition("daily", "home")).toBe(false);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
  });

  it("measures sources before appending identity and link ghosts together", () => {
    const order: string[] = [];
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    const summary = document.querySelector<HTMLElement>(".curation-home__identity")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockImplementation(() => {
      order.push("read-avatar");
      return new DOMRect(10, 20, 80, 80);
    });
    vi.spyOn(summary, "getBoundingClientRect").mockImplementation(() => {
      order.push("read-summary");
      return new DOMRect(12, 112, 240, 64);
    });
    const append = document.body.append.bind(document.body);
    const appendSpy = vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      order.push("append");
      append(...nodes);
    });

    beginProfileTransition("home", "ask");

    expect(order).toEqual(["read-avatar", "read-summary", "append"]);
    expect(document.querySelector(".profile-transition-ghost--links")?.textContent).toBe("GitHub语雀关于我");
    expect(appendSpy).toHaveBeenCalledOnce();
    expect(appendSpy.mock.calls[0]).toHaveLength(3);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(3);
  });
});
