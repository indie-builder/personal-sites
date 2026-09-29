import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("作品集保持独立站点入口", async ({ page, request }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "作品集" });
  const href = "https://portfolio.default-coder.lovemyrmb.cn/";
  await expect(link).toHaveAttribute("href", href);
  await expect(link).toHaveAttribute("target", "_blank");

  const [portfolio, api] = await Promise.all([
    request.get("/portfolio"),
    request.get("/api/portfolio"),
  ]);
  expect(portfolio.status()).toBe(404);
  expect(api.status()).toBe(404);

  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/portfolio-independent.json",
    JSON.stringify({ href, portfolio: 404, api: 404, passed: true }, null, 2) + "\n",
  );
});
