import { expect, test } from "@playwright/test";

// 降级规则的源顺序回归：reduce 覆盖必须排在同特异性的正常声明之后，
// 这里断言的是真实页面样式表里的计算样式，而不是 CSS 文本。
test("stream error fade is neutralized under reduced motion and intact otherwise", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/curation");
  const readComputed = () => page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "curation-home__stream-error";
    document.body.append(probe);
    const { transitionDuration, transitionProperty } = getComputedStyle(probe);
    probe.remove();
    return { transitionDuration, transitionProperty };
  });
  await expect.poll(readComputed).toEqual({ transitionDuration: "0s", transitionProperty: "none" });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(readComputed).toEqual({ transitionDuration: "0.2s", transitionProperty: "opacity" });
});

test("repository panel transitions are neutralized under reduced motion once data arms the entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/open-source/jakubkrehel-skills/repository/tree", (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [{ path: "README.md", size: 12, type: "blob" }],
      repository: "jakubkrehel/skills",
      repositoryUrl: "https://github.com/jakubkrehel/skills",
      truncated: false,
    },
  }));
  await page.goto("/open-source/jakubkrehel-skills");
  await page.getByRole("tab", { name: "仓库结构" }).click();
  const treePane = page.locator('[aria-label="原始仓库文件树"]');
  await expect(treePane).toBeVisible();
  const browserContent = treePane.locator("xpath=..");
  const browserRoot = browserContent.locator("xpath=..");
  // 入场武装（data-entrance）在新数据提交时落下；reduce 下五处 180ms 淡入的计算样式仍必须是 none。
  await expect(browserRoot).toHaveAttribute("data-entrance", "");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
  await expect.poll(() => browserContent.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  const fileEmpty = page.getByText("从左侧文件树选择一个文本文件查看原始内容。");
  await expect.poll(() => fileEmpty.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
});
