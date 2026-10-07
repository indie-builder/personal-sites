import { test, type Browser } from "@e2e-dev/web";
import { expect } from "e2e";
import { emulateReducedMotion } from "./helpers/reduced-motion.ts";

// 框架没有 waitForTimeout：页面内定时器复现固定静置窗口，供「这段时间内不再发生过渡」的
// 负向断言使用（ask-flow 先例）。
function settle(browser: Browser, milliseconds: number) {
  return browser.evaluate((duration: number) => new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), duration);
  }), milliseconds);
}

function installRepositoryTransitions(browser: Browser) {
  return browser.evaluate(() => {
    const testWindow = window as typeof window & { __repositoryTransitions: string[] };
    testWindow.__repositoryTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const panel = document.getElementById("repository-document-panel");
      const target = event.target as Element | null;
      if (panel && target && panel !== target && panel.contains(target)) {
        testWindow.__repositoryTransitions.push((event as TransitionEvent).propertyName);
      }
    });
    return null;
  });
}

function readRepositoryTransitions(browser: Browser) {
  return browser.evaluate(() => (
    window as typeof window & { __repositoryTransitions?: string[] }
  ).__repositoryTransitions ?? []);
}

function resetRepositoryTransitions(browser: Browser) {
  return browser.evaluate(() => {
    const record = (window as typeof window & { __repositoryTransitions?: string[] }).__repositoryTransitions;
    if (record) record.length = 0;
    return null;
  });
}

// 旧 treePane.locator("xpath=..") 取文件树内容的父容器（.repositoryBrowserContent）：
// 页内按 aria-label 单匹配直取其父，两处读取同源。
function readBrowserContent(browser: Browser) {
  return browser.evaluate(() => {
    const panes = document.querySelectorAll('[aria-label="原始仓库文件树"]');
    if (panes.length !== 1) throw new Error(`expected exactly one tree pane, found ${panes.length}`);
    const content = panes[0].parentElement;
    if (!content) throw new Error("tree pane has no parent");
    return { animations: content.getAnimations({ subtree: true }).length, opacity: getComputedStyle(content).opacity };
  });
}

test("open-source filters cap Motion stagger and honor reduced motion", async ({ app, screen, browser }) => {
  const instrumentListMotion = () => browser.evaluate(() => {
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
    return null;
  });
  const readDurations = () => browser.evaluate(() => (
    window as typeof window & { __filterMotionDurations?: number[] }
  ).__filterMotionDurations ?? []);
  await app.open("/open-source");
  // 旧断言经 Playwright 10s 断言预算等完 5s 开机仪式后元素卸载；引擎默认断言预算更短，显式给同额预算。
  await expect(browser.locator(".opening-loader")).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => browser.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-label="已判读的开源项目"] ol > li'))
      .every((row) => row.getAnimations().length === 0),
  )).toBe(true);
  await instrumentListMotion();
  await screen.getByRole("button", "筛选开源关注：全部主题", { exact: false }).click();
  await screen.getByRole("menuitemradio", /^Skills 与工作流 · /u).click();
  await expect(screen.getByRole("button", "筛选开源关注：Skills 与工作流", { exact: false })).toBeVisible();
  const filteredRows = await browser.locator('[aria-label="已判读的开源项目"] ol > li').count();
  await expect.poll(readDurations).toEqual(Array(Math.min(filteredRows, 8)).fill(300));

  await emulateReducedMotion(browser);
  await browser.reload();
  await instrumentListMotion();
  await screen.getByRole("button", "筛选开源关注：全部主题", { exact: false }).click();
  await screen.getByRole("menuitemradio", /^Skills 与工作流 · /u).click();
  await expect(screen.getByRole("button", "筛选开源关注：Skills 与工作流", { exact: false })).toBeVisible();
  expect(await readDurations()).toEqual([]);
  expect(await browser.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-label="已判读的开源项目"] ol > li'))
      .every((row) => getComputedStyle(row).opacity === "1"),
  )).toBe(true);
});

test("repository loading uses Motion and keeps a static reduced state", async ({ app, screen, browser }) => {
  let releaseTree = () => {};
  let treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await browser.route("**/api/open-source/herdr/repository/tree", async (route) => {
    await treeGate;
    await route.fulfill({
      json: {
        branch: "main",
        entries: [],
        repository: "herdrdev/herdr",
        repositoryUrl: "https://github.com/herdrdev/herdr",
        truncated: false,
      },
    });
  });

  await app.open("/open-source/herdr");
  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  const loading = screen.getByText("正在读取原始仓库结构…", { exact: false });
  await expect(loading).toBeVisible();
  // 旧 getByText(...).locator("svg") 按文本定位；模块类名在生产构建被哈希，不能作锚点。
  // 页内取含该文本的唯一文本节点的父段落，再取其中唯一 svg，读取由 locator.evaluate 换成现读。
  const readLoadingIcon = (property: "animationName" | "transform") => browser.evaluate((prop) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parents = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.includes("正在读取原始仓库结构")) parents.add(node.parentElement!);
    }
    const paragraphs = Array.from(parents);
    if (paragraphs.length !== 1) throw new Error(`expected exactly one tree-loading paragraph, found ${paragraphs.length}`);
    const icons = paragraphs[0].querySelectorAll("svg");
    if (icons.length !== 1) throw new Error(`expected exactly one loading icon, found ${icons.length}`);
    return getComputedStyle(icons[0])[prop];
  }, property);
  expect(await readLoadingIcon("animationName")).toBe("none");
  await expect.poll(() => readLoadingIcon("transform")).not.toBe("none");
  releaseTree();
  await expect(loading).toBeHidden();

  treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await emulateReducedMotion(browser);
  await browser.reload();
  await expect(loading).toBeVisible();
  await expect.poll(() => readLoadingIcon("transform")).toBe("none");
  await settle(browser, 300);
  await expect.poll(() => readLoadingIcon("transform")).toBe("none");
  releaseTree();
  await expect(loading).toBeHidden();
});

test("repository entrances fire on fresh data and skip panel hidden round-trips", async ({ app, screen, browser }) => {
  await browser.route("**/api/open-source/herdr/repository/tree", (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "herdrdev/herdr",
      repositoryUrl: "https://github.com/herdrdev/herdr",
      truncated: false,
    },
  }));
  await browser.route("**/api/open-source/herdr/repository/file*", (route) => route.fulfill({
    json: {
      binary: false,
      branch: "main",
      content: "# skills",
      fileUrl: "https://github.com/herdrdev/herdr/blob/main/README.md",
      path: "README.md",
    },
  }));
  await app.open("/open-source/herdr");
  await installRepositoryTransitions(browser);
  const readTransitions = () => readRepositoryTransitions(browser);
  const resetTransitions = () => resetRepositoryTransitions(browser);

  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  const treePane = browser.locator('[aria-label="原始仓库文件树"]');
  await expect(treePane).toBeVisible();
  // 首载淡入保留：树数据提交时 data-entrance 武装，浏览器容器从 0 淡入。
  await expect.poll(readTransitions).toContain("opacity");

  // hidden 往返：回到已渲染的仓库内容必须即时呈现，不重播入场。
  await resetTransitions();
  await screen.getByRole("tab", "中文阅读版", { exact: false }).click();
  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  await expect(treePane).toBeVisible();
  await settle(browser, 300);
  expect(await readTransitions()).toEqual([]);
  await expect.poll(async () => (await readBrowserContent(browser)).opacity).toBe("1");
  expect((await readBrowserContent(browser)).animations).toBe(0);

  // 新文件数据到达仍按换场淡入。
  await resetTransitions();
  await screen.getByRole("button", /^README\.md/u).click();
  await expect(screen.getByText("# skills", { exact: false })).toBeVisible();
  await expect.poll(readTransitions).toContain("opacity");
});

test("response committed while the repository panel is hidden returns without replaying the entrance", async ({ app, screen, browser }) => {
  let releaseTree = () => {};
  const treeGate = new Promise<void>((resolve) => { releaseTree = resolve; });
  await browser.route("**/api/open-source/herdr/repository/tree", async (route) => {
    await treeGate;
    await route.fulfill({
      json: {
        branch: "main",
        entries: [{ path: "README.md", size: 12, type: "blob" }],
        repository: "herdrdev/herdr",
        repositoryUrl: "https://github.com/herdrdev/herdr",
        truncated: false,
      },
    });
  });

  await app.open("/open-source/herdr");
  await installRepositoryTransitions(browser);
  const readTransitions = () => readRepositoryTransitions(browser);

  // 请求在途时切走：响应在面板隐藏期间提交，必须丢弃入场资格。
  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  const loading = screen.getByText("正在读取原始仓库结构…", { exact: false });
  await expect(loading).toBeAttached();
  await screen.getByRole("tab", "中文阅读版", { exact: false }).click();
  await expect(screen.getByRole("tab", "中文阅读版", { exact: false })).toHaveAttribute("aria-selected", "true");
  releaseTree();
  // 树数据已在隐藏的面板里提交（文件树节点存在于 DOM），但 data-entrance 未落下。
  const treePane = browser.locator('[aria-label="原始仓库文件树"]');
  await expect.poll(() => treePane.count()).toBe(1);
  await expect(browser.locator("#repository-document-panel [data-entrance]")).toHaveCount(0);

  // 回到面板：内容即时呈现，无过渡事件、无在途动画。
  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  await expect(treePane).toBeVisible();
  await settle(browser, 300);
  expect(await readTransitions()).toEqual([]);
  await expect(browser.locator("#repository-document-panel [data-entrance]")).toHaveCount(0);
  await expect.poll(async () => (await readBrowserContent(browser)).opacity).toBe("1");
  expect((await readBrowserContent(browser)).animations).toBe(0);
});

// reduce 段（真实换场在 CSS @media 降级下即时呈现）依赖引擎无法模拟的媒体特性，
// 留在 open-source-motion.spec.ts；本条覆盖其鼠标换场与键盘即时部分。
test("document panels bridge click switches and stay instant from the keyboard", async ({ app, screen, browser }) => {
  await browser.route("**/api/open-source/herdr/repository/tree", (route) => route.fulfill({
    json: {
      branch: "master",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "herdrdev/herdr",
      repositoryUrl: "https://github.com/herdrdev/herdr",
      truncated: false,
    },
  }));

  await app.open("/open-source/herdr");
  await browser.evaluate(() => {
    const testWindow = window as typeof window & { __panelTransitions: string[] };
    testWindow.__panelTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.id === "parsed-document-panel" || target?.id === "repository-document-panel") {
        testWindow.__panelTransitions.push(`${target.id}:${(event as TransitionEvent).propertyName}`);
      }
    });
    return null;
  });
  const readPanelTransitions = () => browser.evaluate(() => (
    window as typeof window & { __panelTransitions?: string[] }
  ).__panelTransitions ?? []);
  const resetPanelTransitions = () => browser.evaluate(() => {
    const record = (window as typeof window & { __panelTransitions?: string[] }).__panelTransitions;
    if (record) record.length = 0;
    return null;
  });

  const repositoryTab = screen.getByRole("tab", "仓库结构", { exact: false });
  const parsedTab = screen.getByRole("tab", "中文阅读版", { exact: false });
  // 鼠标点击换场：面板本体从透明上浮，只有入场。
  await repositoryTab.click();
  await expect.poll(readPanelTransitions).toContain("repository-document-panel:opacity");
  await expect.poll(readPanelTransitions).toContain("repository-document-panel:transform");

  // 键盘换场（moveTab 方向键与 detail === 0 的合成 click）直接呈现，无过渡事件。
  await resetPanelTransitions();
  await repositoryTab.focus();
  await browser.keyboard.press("ArrowLeft");
  await expect(parsedTab).toBeFocused();
  await expect(browser.locator("#parsed-document-panel")).toBeVisible();
  await repositoryTab.focus();
  await browser.keyboard.press("Enter");
  await expect(browser.locator("#repository-document-panel")).toBeVisible();
  await settle(browser, 300);
  expect(await readPanelTransitions()).toEqual([]);
  await expect(browser.locator("#repository-document-panel")).toHaveAttribute("data-instant");

  // 键盘置位后鼠标切换必须复位入场：回到中文阅读版仍有过渡，旧面板即时隐藏。
  await resetPanelTransitions();
  await parsedTab.click();
  await expect(browser.locator("#repository-document-panel")).toBeHidden();
  await expect.poll(readPanelTransitions).toContain("parsed-document-panel:opacity");
});
