#!/usr/bin/env node
// 作品集离线同步入口：数据采集脚本互相独立，单源失败不阻塞其他源。
// 用法：node scripts/portfolio-sync.mjs <inspora|layouts|tools|site|avatars> [-- ...]
// 同步只写 data/sensitive/portfolio 与 apps/web/public 资产；发布公共投影用 portfolio:project。

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const modules = {
  inspora: "modules/portfolio/inspora/sync.ts",
  layouts: "modules/portfolio/layouts/sync.ts",
  tools: "modules/portfolio/design-engineer-tools/sync.ts",
  site: "modules/portfolio/personal-sites/sync.ts",
  avatars: "modules/portfolio/ai-chat/sync-avatars.ts",
};

const [target, ...rest] = process.argv.slice(2);
if (!target || !modules[target]) {
  console.error(`用法：portfolio-sync.mjs <${Object.keys(modules).join("|")}> [-- 透传参数]`);
  process.exitCode = 1;
} else {
  const run = spawnSync(process.execPath, [path.join(scriptsRoot, modules[target]), ...rest], {
    stdio: "inherit",
  });
  process.exitCode = run.status ?? 1;
}
