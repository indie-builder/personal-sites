import { copyFileSync, mkdirSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Only approved public snapshots enter the Web deployment. Never copy the data directory recursively.
//
// 两份用途明确的副本：
// - data/           —— dev / vitest / 本地 node 预览按 cwd 读取；
// - assets/data/    —— nitro 的 server assets 构建输入，随产物打包进 chunks/raw。
const destinations = [new URL("../data/", import.meta.url), new URL("../assets/data/", import.meta.url)];
for (const destination of destinations) mkdirSync(destination, { recursive: true });
for (const name of ["curation.sqlite", "ai-news.sqlite"]) {
  const source = new URL(`../../../data/${name}`, import.meta.url);
  for (const destination of destinations) {
    const target = new URL(name, destination);
    const temporary = `${fileURLToPath(target)}.${process.pid}.tmp`;
    copyFileSync(source, temporary);
    renameSync(temporary, target);
  }
}
