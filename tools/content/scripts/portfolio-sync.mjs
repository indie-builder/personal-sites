#!/usr/bin/env node
// 作品集离线同步入口：数据采集脚本互相独立，单源失败不阻塞其他源。
// 用法：node scripts/portfolio-sync.mjs <inspora|layouts|tools|site|avatars> [-- 透传参数]
// 同步只写 data/sensitive/portfolio 与 apps/web/public 资产；发布公共投影用 portfolio:project。

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const modules = {
  inspora: "../modules/portfolio/inspora/sync.ts",
  layouts: "../modules/portfolio/layouts/sync.ts",
  tools: "../modules/portfolio/design-engineer-tools/sync.ts",
  site: "../modules/portfolio/personal-sites/sync.ts",
  avatars: "../modules/portfolio/ai-chat/sync-avatars.ts",
};
const usage = `用法：portfolio-sync.mjs <${Object.keys(modules).join("|")}> [-- 透传参数]
  inspora   灵感集三源同步（--full 全量、--source=<name> 单源、--max-pages N）
  layouts   布局图鉴图片同步（--with-images 另出高清图）
  tools     设计工程工具目录同步
  site      个人站点截图与宣传片同步
  avatars   AI 问答头像导入（-- <young-avatars-20.zip 路径>）`;

const [target, ...rest] = process.argv.slice(2);
if (target === "--help" || target === "-h") {
  console.log(usage);
} else if (!target || !modules[target]) {
  console.error(usage);
  process.exitCode = 1;
} else {
  // pnpm 透传的 `--` 分隔符不是模块参数，转发前剔除。
  const forward = rest[0] === "--" ? rest.slice(1) : rest;
  const run = spawnSync(process.execPath, [path.join(scriptsRoot, modules[target]), ...forward], {
    stdio: "inherit",
  });
  process.exitCode = run.status ?? 1;
}
