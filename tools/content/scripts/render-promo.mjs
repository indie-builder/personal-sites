#!/usr/bin/env node
// 个人站点宣传片渲染：驱动 Remotion 渲染 promo.mp4 与 poster.png。
// 输入是 tools/content/modules/portfolio/personal-sites/promo 内的跟踪工程与冻结截图；
// 成片写入 data/sensitive/portfolio/personal-sites/promo-out（本机保留，不入 Git），
// 随后运行 pnpm portfolio:sync -- site 同步到站点 public。
// 路径一律从脚本位置解析，不依赖执行时工作目录。

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const promoRoot = path.resolve(scriptDir, "../modules/portfolio/personal-sites/promo");
const repoRoot = path.resolve(scriptDir, "../../..");
const outDir = path.join(repoRoot, "data/sensitive/portfolio/personal-sites/promo-out");

const usage = `用法：node scripts/render-promo.mjs [-- 透传 Remotion 参数]
输入：${path.relative(repoRoot, promoRoot)}
输出：${path.relative(repoRoot, outDir)}/promo.mp4 与 poster.png
例：追加 -- --browser-executable=/path/to/chrome-headless-shell 指定浏览器。`;

const passthrough = process.argv.slice(2);
if (passthrough.includes("--help") || passthrough.includes("-h")) {
  console.log(usage);
  process.exit(0);
}
const remotionArgs = passthrough[0] === "--" ? passthrough.slice(1) : passthrough;

function resolveRemotionCli() {
  try {
    const require = createRequire(import.meta.url);
    const manifestPath = require.resolve("@remotion/cli/package.json");
    const manifest = require(manifestPath);
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.remotion;
    if (!bin) throw new Error("@remotion/cli 缺少 remotion bin 声明");
    return [process.execPath, path.join(path.dirname(manifestPath), bin)];
  } catch {
    return ["remotion", []];
  }
}

mkdirSync(outDir, { recursive: true });
const common = [path.join(promoRoot, "src/index.tsx"), "PersonalSitePromo"];
const options = [`--public-dir=${promoRoot}/public`, ...remotionArgs];
const [command, commandArgs] = resolveRemotionCli();
for (const args of [
  [
    "render",
    ...common,
    path.join(outDir, "promo.mp4"),
    "--codec=h264",
    "--muted",
    "--crf=19",
    "--pixel-format=yuv420p",
    "--concurrency=2",
    ...options,
  ],
  ["still", ...common, path.join(outDir, "poster.png"), "--frame=75", ...options],
]) {
  const result = spawnSync(command, [...commandArgs, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`渲染完成：${outDir}`);
console.log("运行 pnpm portfolio:sync -- site 把成片同步到站点 public。");
