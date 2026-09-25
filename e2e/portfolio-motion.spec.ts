import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

type MotionRecord = { id: string; transform: string; duration: number };

test("个人站与作品集的指针往返有可见动效，键盘与减少动态效果即时切换", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await page.evaluate(() => {
    const state = window as typeof window & { __portfolioMotion?: MotionRecord[] };
    const original = Element.prototype.animate;
    state.__portfolioMotion = [];
    Element.prototype.animate = function (...args) {
      if (this.id === "site-canvas" || this.id === "workspace-content") {
        const first = Array.isArray(args[0]) ? args[0][0] as Keyframe : undefined;
        state.__portfolioMotion!.push({
          id: this.id,
          transform: String(first?.transform ?? ""),
          duration: Number(typeof args[1] === "object" ? args[1]?.duration : args[1]),
        });
      }
      return original.apply(this, args);
    };
  });
  const motions = () => page.evaluate(() => (window as typeof window & { __portfolioMotion?: MotionRecord[] }).__portfolioMotion ?? []);

  await page.getByRole("link", { name: "返回个人站" }).click();
  await expect(page).toHaveURL("/");
  await expect.poll(async () => (await motions()).filter((motion) => motion.id === "site-canvas").length).toBe(1);
  expect((await motions())[0]).toMatchObject({ transform: "translateX(-24px)", duration: 240 });

  await page.getByRole("link", { name: "作品集" }).click();
  await expect(page).toHaveURL("/portfolio");
  await expect.poll(async () => (await motions()).filter((motion) => motion.id === "site-canvas").length).toBe(2);
  expect((await motions()).filter((motion) => motion.id === "site-canvas")[1]).toMatchObject({ transform: "translateX(24px)", duration: 240 });

  await page.getByRole("link", { name: "进入灵感集" }).click();
  await expect(page).toHaveURL("/portfolio/products/muse");
  await expect.poll(async () => (await motions()).filter((motion) => motion.id === "workspace-content").length).toBeGreaterThan(0);
  await page.getByRole("link", { name: "灵感集，返回首页" }).click();
  await expect(page).toHaveURL("/portfolio");
  await expect.poll(async () => (await motions()).filter((motion) => motion.id === "workspace-content").length).toBeGreaterThan(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: "返回个人站" }).click();
  await expect(page.locator("#site-main")).toBeVisible();
  expect((await motions()).filter((motion) => motion.id === "site-canvas")).toHaveLength(2);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("link", { name: "作品集" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#portfolio-root")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.input)).toBe("keyboard");
  expect((await motions()).filter((motion) => motion.id === "site-canvas")).toHaveLength(2);

  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/portfolio-motion.json", JSON.stringify({ pointerEnter: "24px / 240ms", pointerReturn: "-24px / 240ms", productRoundTrip: "animated", reducedMotion: "instant", keyboard: "instant" }, null, 2) + "\n");
});
