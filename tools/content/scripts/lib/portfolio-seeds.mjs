// 发布输入种子：全新 checkout 没有 personal-design 原始目录时，
// 把工具模块里跟踪的安全公开目录补进离线输入根目录；只补缺，不覆盖本机副本。
import { copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../modules/portfolio",
);

const SEEDS = [
  ["layouts/catalog.json", "catalog.json"],
  ["layouts/corrections.json", "corrections.json"],
  ["design-engineer-tools/catalog.json", "design-engineer-tools/catalog.json"],
];

export function bootstrapPortfolioSeeds(inputRoot) {
  return Promise.all(
    SEEDS.map(async ([seed, relative]) => {
      const target = path.join(inputRoot, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(MODULES_ROOT, seed), target, constants.COPYFILE_EXCL).catch(
        (error) => {
          if (error.code !== "EEXIST") throw error;
        },
      );
    }),
  );
}
