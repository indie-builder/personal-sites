import { expect, test } from "@playwright/test";

test("open-source filters cap Motion stagger and honor reduced motion", async ({ page }) => {
  const instrumentListMotion = () => page.evaluate(() => {
    const testWindow = window as typeof window & { __filterMotionDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__filterMotionDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (this instanceof HTMLLIElement && this.closest('[aria-label="已判读的开源项目"]')) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__filterMotionDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });
  const readDurations = () => page.evaluate(() => (
    window as typeof window & { __filterMotionDurations?: number[] }
  ).__filterMotionDurations ?? []);

  await page.goto("/open-source");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await expect.poll(() => page.locator('[aria-label="已判读的开源项目"] ol > li').evaluateAll(rows => rows.every(row => row.getAnimations().length === 0))).toBe(true);
  await instrumentListMotion();
  await page.getByRole("button", { name: "筛选开源关注：全部主题" }).click();
  await page.getByRole("menuitemradio", { name: /^Skills 与工作流 · /u }).click();
  await expect(page.getByRole("button", { name: "筛选开源关注：Skills 与工作流" })).toBeVisible();
  const filteredRows = await page.locator('[aria-label="已判读的开源项目"] ol > li').count();
  await expect.poll(readDurations).toEqual(Array(Math.min(filteredRows, 8)).fill(280));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await instrumentListMotion();
  await page.getByRole("button", { name: "筛选开源关注：全部主题" }).click();
  await page.getByRole("menuitemradio", { name: /^Skills 与工作流 · /u }).click();
  await expect(page.getByRole("button", { name: "筛选开源关注：Skills 与工作流" })).toBeVisible();
  expect(await readDurations()).toEqual([]);
  expect(await page.locator('[aria-label="已判读的开源项目"] ol > li').evaluateAll((rows) => (
    rows.every((row) => getComputedStyle(row).opacity === "1")
  ))).toBe(true);
});

test("repository loading uses Motion and keeps a static reduced state", async ({ page }) => {
  let releaseTree = () => {};
  let treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await page.route("**/api/open-source/jakubkrehel-skills/repository/tree", async (route) => {
    await treeGate;
    await route.fulfill({
      json: {
        branch: "main",
        entries: [],
        repository: "jakubkrehel/skills",
        repositoryUrl: "https://github.com/jakubkrehel/skills",
        truncated: false,
      },
    });
  });

  await page.goto("/open-source/jakubkrehel-skills");
  await page.getByRole("tab", { name: "仓库结构" }).click();
  const loading = page.getByText("正在读取原始仓库结构…");
  const icon = loading.locator("svg");
  await expect(loading).toBeVisible();
  expect(await icon.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect.poll(() => icon.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  releaseTree();
  await expect(loading).toBeHidden();

  treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(loading).toBeVisible();
  await expect(icon).toHaveCSS("transform", "none");
  await page.waitForTimeout(300);
  await expect(icon).toHaveCSS("transform", "none");
  releaseTree();
  await expect(loading).toBeHidden();
});
