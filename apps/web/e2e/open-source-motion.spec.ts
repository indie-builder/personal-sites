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

test("repository entrances fire on fresh data and skip panel hidden round-trips", async ({ page }) => {
  await page.route("**/api/open-source/jakubkrehel-skills/repository/tree", (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "jakubkrehel/skills",
      repositoryUrl: "https://github.com/jakubkrehel/skills",
      truncated: false,
    },
  }));
  await page.route("**/api/open-source/jakubkrehel-skills/repository/file*", (route) => route.fulfill({
    json: {
      binary: false,
      branch: "main",
      content: "# skills",
      fileUrl: "https://github.com/jakubkrehel/skills/blob/main/README.md",
      path: "README.md",
    },
  }));
  await page.goto("/open-source/jakubkrehel-skills");
  await page.evaluate(() => {
    const w = window as typeof window & { __repositoryTransitions: string[] };
    w.__repositoryTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const panel = document.getElementById("repository-document-panel");
      const target = event.target as Element | null;
      if (panel && target && panel !== target && panel.contains(target)) {
        w.__repositoryTransitions.push((event as TransitionEvent).propertyName);
      }
    });
  });
  const readTransitions = () => page.evaluate(() => (
    window as typeof window & { __repositoryTransitions?: string[] }
  ).__repositoryTransitions ?? []);
  const resetTransitions = () => page.evaluate(() => {
    const record = (window as typeof window & { __repositoryTransitions?: string[] }).__repositoryTransitions;
    if (record) record.length = 0;
  });

  await page.getByRole("tab", { name: "仓库结构" }).click();
  const treePane = page.locator('[aria-label="原始仓库文件树"]');
  await expect(treePane).toBeVisible();
  // 首载淡入保留：树数据提交时 data-entrance 武装，浏览器容器从 0 淡入。
  await expect.poll(readTransitions).toContain("opacity");

  // hidden 往返：回到已渲染的仓库内容必须即时呈现，不重播入场。
  await resetTransitions();
  await page.getByRole("tab", { name: "中文阅读版" }).click();
  await page.getByRole("tab", { name: "仓库结构" }).click();
  await expect(treePane).toBeVisible();
  await page.waitForTimeout(300);
  expect(await readTransitions()).toEqual([]);
  const browserContent = treePane.locator("xpath=..");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  expect(await browserContent.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);

  // 新文件数据到达仍按换场淡入。
  await resetTransitions();
  await page.getByRole("button", { name: /^README\.md/u }).click();
  await expect(page.getByText("# skills")).toBeVisible();
  await expect.poll(readTransitions).toContain("opacity");
});

test("response committed while the repository panel is hidden returns without replaying the entrance", async ({ page }) => {
  let releaseTree = () => {};
  const treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await page.route("**/api/open-source/jakubkrehel-skills/repository/tree", async (route) => {
    await treeGate;
    await route.fulfill({
      json: {
        branch: "main",
        entries: [{ path: "README.md", size: 12, type: "blob" }],
        repository: "jakubkrehel/skills",
        repositoryUrl: "https://github.com/jakubkrehel/skills",
        truncated: false,
      },
    });
  });

  await page.goto("/open-source/jakubkrehel-skills");
  await page.evaluate(() => {
    const w = window as typeof window & { __repositoryTransitions: string[] };
    w.__repositoryTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const panel = document.getElementById("repository-document-panel");
      const target = event.target as Element | null;
      if (panel && target && panel !== target && panel.contains(target)) {
        w.__repositoryTransitions.push((event as TransitionEvent).propertyName);
      }
    });
  });
  const readTransitions = () => page.evaluate(() => (
    window as typeof window & { __repositoryTransitions?: string[] }
  ).__repositoryTransitions ?? []);

  // 请求在途时切走：响应在面板隐藏期间提交，必须丢弃入场资格。
  await page.getByRole("tab", { name: "仓库结构" }).click();
  const loading = page.getByText("正在读取原始仓库结构…");
  await expect(loading).toBeAttached();
  await page.getByRole("tab", { name: "中文阅读版" }).click();
  await expect(page.getByRole("tab", { name: "中文阅读版" })).toHaveAttribute("aria-selected", "true");
  releaseTree();
  // 树数据已在隐藏的面板里提交（文件树节点存在于 DOM），但 data-entrance 未落下。
  const treePane = page.locator('[aria-label="原始仓库文件树"]');
  await expect.poll(() => treePane.count()).toBe(1);
  await expect(page.locator("#repository-document-panel [data-entrance]")).toHaveCount(0);

  // 回到面板：内容即时呈现，无过渡事件、无在途动画。
  await page.getByRole("tab", { name: "仓库结构" }).click();
  await expect(treePane).toBeVisible();
  await page.waitForTimeout(300);
  expect(await readTransitions()).toEqual([]);
  await expect(page.locator("#repository-document-panel [data-entrance]")).toHaveCount(0);
  const browserContent = treePane.locator("xpath=..");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  expect(await browserContent.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});
