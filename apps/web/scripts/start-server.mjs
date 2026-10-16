// Nitro 的 Node 服务只认 PORT 环境变量；e2e 运行器与 Playwright 用 `--port N`
// 传端口（与迁移前 next start 的约定一致），这里显式翻译过去。
const portIndex = process.argv.indexOf("--port");
if (portIndex !== -1 && process.argv[portIndex + 1]) {
  process.env.PORT ??= process.argv[portIndex + 1];
}

await import("../.output/server/index.mjs");
