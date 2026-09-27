#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { databasePath, defaultInputs, repoRoot } from "../modules/local-vectors/config.mjs";
import { buildIndex, rebuildDefaultIndex } from "../modules/local-vectors/indexer.mjs";
import { search } from "../modules/local-vectors/search.mjs";

function printHelp() {
  console.log(`用法：
  pnpm vectors:index [项目内目录或文件 ...]
  pnpm vectors:search <查询内容>

默认索引：${defaultInputs.join("、")}
本地数据库：${path.relative(repoRoot, databasePath)}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "index") {
    const useDefaults = args.length === 0;
    return useDefaults ? rebuildDefaultIndex() : buildIndex(args);
  }
  if (command === "search") return search(args.join(" "));
  printHelp();
  if (command && command !== "help" && command !== "--help") process.exitCode = 1;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
