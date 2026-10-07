import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { mkdir, writeFile } from "node:fs/promises";

test("作品集保持独立站点入口", async ({ app, screen }) => {
  await app.open("/");
  const link = screen.getByRole("link", "作品集", { exact: false });
  const href = "https://portfolio.default-coder.lovemyrmb.cn/";
  await expect(link).toHaveAttribute("href", href);
  await expect(link).toHaveAttribute("target", "_blank");

  const [portfolio, api] = await Promise.all([
    fetch(new URL("/portfolio", app.baseUrl)),
    fetch(new URL("/api/portfolio", app.baseUrl)),
  ]);
  expect(portfolio.status).toBe(404);
  expect(api.status).toBe(404);

  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/portfolio-independent.json",
    JSON.stringify({ href, portfolio: 404, api: 404, passed: true }, null, 2) + "\n",
  );
});
