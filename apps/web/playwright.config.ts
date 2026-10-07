import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: process.env.CI ? 2 : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "line",
  // e2e/ 同时是 e2e 运行器（*.e2e.ts，入口 pnpm test:e2e）与 Playwright（*.spec.ts，入口
  // pnpm test:e2e:touch）的目录；Playwright 的 testMatch 只认 *.spec.ts 留守件——触摸设备
  // 仿真与 prefers-reduced-motion CSS 用例，见各 spec 头注释。
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:7100",
    trace: "retain-on-failure",
  },
  webServer: {
    // Opt in only after a successful build of the same checkout (for example, the CI verification step).
    command: process.env.PLAYWRIGHT_REUSE_BUILD === "1"
      ? "pnpm start --port 7100"
      : "pnpm build && pnpm start --port 7100",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:7100/curation",
  },
});
