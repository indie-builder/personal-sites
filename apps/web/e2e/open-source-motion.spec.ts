import { expect, test } from "@playwright/test";

// 留守件（与 curation-detail-responsive.spec.ts 同类）：本用例断言 prefers-reduced-motion 的
// CSS @media 计算样式与由 CSS 规则压掉的面板换场过渡。e2e 运行器（@e2e-dev/web）没有
// emulateMedia，引擎也不模拟该媒体特性；matchMedia 补丁只影响 JS 现读，改不了 CSS 级联，
// 此处无法等价表达。可搬迁部分已入 open-source-motion.e2e.ts。
test("document panel switches stay instant under reduced motion", async ({ page }) => {
  await page.route("**/api/open-source/herdr/repository/tree", (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "herdrdev/herdr",
      repositoryUrl: "https://github.com/herdrdev/herdr",
      truncated: false,
    },
  }));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/open-source/herdr");
  await page.evaluate(() => {
    const w = window as typeof window & { __panelTransitions: string[] };
    w.__panelTransitions = [];
    document.addEventListener("transitionstart", (event) => {
      const target = event.target as Element | null;
      if (target?.id === "parsed-document-panel" || target?.id === "repository-document-panel") {
        w.__panelTransitions.push(`${target.id}:${(event as TransitionEvent).propertyName}`);
      }
    });
  });
  const readPanelTransitions = () => page.evaluate(() => (
    window as typeof window & { __panelTransitions?: string[] }
  ).__panelTransitions ?? []);

  // reduce 下真实鼠标换场直接呈现；纯颜色过渡按站内惯例保留。
  const repositoryTab = page.getByRole("tab", { name: "仓库结构" });
  await repositoryTab.click();
  await expect(page.locator("#repository-document-panel")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await readPanelTransitions()).toEqual([]);
  await expect(page.locator("#repository-document-panel")).toHaveCSS("transition-property", "none");
  await expect(repositoryTab).toHaveCSS("transition-property", "color");
  await expect(repositoryTab).toHaveCSS("transition-duration", "0.2s");
});
