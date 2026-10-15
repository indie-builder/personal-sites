import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  server: {
    // 端口约定与迁移前一致：应用固定 3000，由根目录 dev:domain 通过 portless 暴露域名。
    port: 3000,
    host: "127.0.0.1",
  },
  plugins: [
    // tanstackStart 必须在 viteReact 之前；nitro 负责服务端打包与各部署目标适配。
    tanstackStart(),
    nitro(),
    // Tailwind v4 走原生 Vite 插件：PostCSS 方案在 SSR 环境会把 @import "tailwindcss" 解析成相对路径。
    tailwindcss(),
    viteReact(),
  ],
});
