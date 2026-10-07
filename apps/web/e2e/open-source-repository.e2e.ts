import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// slug 会随每日同步消失（#56），所以从 /open-source 渲染列表现取目标。
test("repository file failure surfaces in place and reselecting the same file recovers", async ({ app, screen, browser }) => {
  await app.open("/open-source");
  const detailLink = browser.locator('a[href^="/open-source/"]').first();
  await expect(detailLink).toBeVisible();
  const detailPath = await detailLink.getAttribute("href");
  const slug = (detailPath ?? "").split("/").filter(Boolean).at(-1) ?? "";
  expect(slug, detailPath ?? "").not.toBe("");

  const repositoryUrl = `https://github.com/example/${slug}`;
  const fileUrl = `${repositoryUrl}/blob/main/docs/guide.md`;
  await browser.route(`**/api/open-source/${slug}/repository/tree`, (route) => route.fulfill({
    json: {
      branch: "main",
      entries: [
        { path: "README.md", size: 12, type: "blob" },
        { path: "docs", type: "tree" },
        { path: "docs/guide.md", size: 30, type: "blob" },
      ],
      repository: `example/${slug}`,
      repositoryUrl,
      truncated: false,
    },
  }));
  let guideRequests = 0;
  await browser.route(`**/api/open-source/${slug}/repository/file*`, async (route) => {
    const path = new URL(route.request.url).searchParams.get("path") ?? "";
    if (path !== "docs/guide.md") {
      await route.fulfill({ json: { binary: false, branch: "main", content: "", fileUrl, path } });
      return;
    }
    guideRequests += 1;
    if (guideRequests === 1) {
      await route.fulfill({ json: { error: "模拟读取失败" }, status: 500 });
      return;
    }
    await route.fulfill({
      json: {
        binary: false,
        branch: "main",
        content: "# 指南内容",
        fileUrl,
        path,
      },
    });
  });

  await app.open(`/open-source/${slug}`);
  await screen.getByRole("tab", "仓库结构", { exact: false }).click();
  const treePane = browser.locator('[aria-label="原始仓库文件树"]');
  await expect(treePane).toBeVisible();

  const docsNode = treePane.getByRole("button", "docs");
  await expect(docsNode).toHaveAttribute("aria-expanded", "false");
  await docsNode.click();
  const guideRow = treePane.getByRole("button", /^guide\.md/u);
  await expect(guideRow).toBeVisible();

  await guideRow.click();
  const failure = screen.getByText("模拟读取失败", { exact: false });
  await expect(failure).toBeVisible();
  await expect(treePane).toBeVisible();
  await expect(guideRow).toBeVisible();

  await guideRow.click();
  await expect(failure).toBeHidden();
  await expect(screen.getByText("# 指南内容", { exact: false })).toBeVisible();
  // 头部路径 code 拿不到稳定类名（生产构建哈希），aria 面板内仅头部 code 是 div 直接子节点。
  const fileHeaderCode = browser.locator('[aria-label="原始文件内容"] > div > code');
  await expect(fileHeaderCode).toHaveText("docs/guide.md");
  const githubLink = browser.locator('[aria-label="原始文件内容"] a').first();
  await expect(githubLink).toHaveAttribute("href", fileUrl);
  await docsNode.click();
  await expect(docsNode).toHaveAttribute("aria-expanded", "false");
  await expect(guideRow).toBeHidden();
});
