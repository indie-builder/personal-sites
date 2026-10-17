import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./tests/support/server-only-stub.ts", import.meta.url).pathname,
      "@tanstack/react-start/server-only": new URL("./tests/support/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    // vmThreads：jsdom 环境每 worker 只建一次（默认 threads 每文件重建一次，
    // 40 个文件的环境创建占了整轮 45%）。保留单文件隔离；VM 缺失的 Node web
    // 全局由 tests/support/vm-globals.ts 按缺补齐。
    pool: "vmThreads",
    setupFiles: ["tests/support/vm-globals.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "tests/**/*.vitest.mjs"],
    passWithNoTests: false,
  },
});
