import { afterEach, describe, expect, test } from "bun:test";
import { readReducedMotion, setReducedMotion } from "../src/lib/motion";
import { readFileSync } from "node:fs";

const original = Object.getOwnPropertyDescriptor(globalThis, "wx");
afterEach(() => {
  if (original) Object.defineProperty(globalThis, "wx", original);
  else Reflect.deleteProperty(globalThis, "wx");
});

describe("native reduced-motion preference", () => {
  test("system reduction keeps entries static but completes their cleanup event", () => {
    const styles = readFileSync(new URL("../src/app.wxss", import.meta.url), "utf8");
    expect(styles).toContain("@keyframes motion-settled");
    expect(styles).toContain("animation: motion-settled 1ms linear !important");
    expect(styles).toContain("animation-delay: 0ms !important");
    expect(styles).toContain("opacity: 1 !important");
    expect(styles).toContain("transform: none !important");
  });
  test("persists an explicit boolean without changing the network or conversation", () => {
    const storage = new Map<string, unknown>();
    Object.defineProperty(globalThis, "wx", { configurable: true, value: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    } });
    expect(readReducedMotion()).toBe(false);
    setReducedMotion(true);
    expect(readReducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(readReducedMotion()).toBe(false);
  });

  test("unavailable storage chooses the static path and a failed save stays visible", () => {
    const notices: string[] = [];
    Object.defineProperty(globalThis, "wx", { configurable: true, value: {
      getStorageSync() { throw new Error("unavailable"); },
      setStorageSync() { throw new Error("full"); },
      showToast: ({ title }: { title: string }) => notices.push(title),
    } });
    expect(readReducedMotion()).toBe(true);
    setReducedMotion(true);
    expect(notices).toEqual(["偏好未能保存，请重试"]);
  });
});
