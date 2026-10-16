import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Only approved public snapshots enter the Web deployment. Never copy the data directory recursively.
//
// 三份产物，各有用途：
// - data/                         —— dev / vitest / 本地 node 预览按 cwd 读取；
// - assets/bundle/*.generated.mjs —— nitro 服务端 bundle 的内联字节模块（Vercel
//   函数没有 cwd 数据，运行时从该模块取字节开库）；.mjs 本体 gitignore，只提交 .d.mts 类型。
const dataDir = new URL("../data/", import.meta.url);
const bundleMjs = new URL("../assets/bundle/bundled-data.generated.mjs", import.meta.url);
const bundleDmts = new URL("../assets/bundle/bundled-data.generated.d.mts", import.meta.url);
mkdirSync(dataDir, { recursive: true });
mkdirSync(new URL("../assets/bundle/", import.meta.url), { recursive: true });

const entries = [
  { name: "curation.sqlite", exportName: "curationDatabaseB64" },
  { name: "ai-news.sqlite", exportName: "aiNewsArchiveB64" },
];
for (const { name } of entries) {
  const source = new URL(`../../../data/${name}`, import.meta.url);
  const target = new URL(name, dataDir);
  const temporary = `${fileURLToPath(target)}.${process.pid}.tmp`;
  copyFileSync(source, temporary);
  renameSync(temporary, target);
}

const toB64 = (url) => readFileSync(url).toString("base64");
const lines = [
  ...entries.map(({ name, exportName }) =>
    `export const ${exportName} = ${JSON.stringify(toB64(new URL(`../data/${name}`, import.meta.url)))};`),
  `export const ogFontB64 = ${JSON.stringify(toB64(new URL("../assets/fonts/noto-sans-sc-og.ttf", import.meta.url)))};`,
];
writeFileSync(bundleDmts,
  "export declare const curationDatabaseB64: string;\nexport declare const aiNewsArchiveB64: string;\nexport declare const ogFontB64: string;\n");
writeFileSync(bundleMjs, `// 由 scripts/prepare-data.mjs 生成，勿手改。\n${lines.join("\n")}\n`);
