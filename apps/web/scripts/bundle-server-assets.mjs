import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// vite build 之后运行：把运行时只读资源显式放进服务端产物。
// - data/            —— cwd 相对契约（@site/public-data）+ 部署函数内读取；
// - assets/fonts/    —— OG 分享图的内嵌字体。
// nitro 的 presets 会把 .output/server 的内容原样带进部署函数，因此拷进
// .output/server 即覆盖本地 node 预览与 Vercel 两种运行形态。

const appDir = path.dirname(fileURLToPath(import.meta.url));
const serverOutput = path.resolve(appDir, "../.output/server");

if (!existsSync(serverOutput)) {
  console.error("bundle-server-assets: 未找到 .output/server，请先运行 vite build。");
  process.exit(1);
}

mkdirSync(path.join(serverOutput, "data"), { recursive: true });
for (const name of ["curation.sqlite", "ai-news.sqlite"]) {
  copyFileSync(path.resolve(appDir, "../data", name), path.join(serverOutput, "data", name));
}

const fontsSource = path.resolve(appDir, "../assets/fonts");
if (existsSync(fontsSource)) {
  cpSync(fontsSource, path.join(serverOutput, "assets", "fonts"), { recursive: true });
}

const copied = readdirSync(path.join(serverOutput, "data"));
console.log(`bundle-server-assets: data=${copied.join(",")} fonts=${existsSync(path.join(serverOutput, "assets/fonts")) ? "ok" : "missing"}`);
