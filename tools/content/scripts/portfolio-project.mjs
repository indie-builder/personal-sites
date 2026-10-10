import { Effect } from "effect";
import { runCli } from "@site/effect/cli";
import { io } from "@site/effect";

import { publishPortfolio, DEFAULT_INPUT_ROOT } from "../modules/portfolio/project.mjs";
import { bootstrapPortfolioSeeds } from "./lib/portfolio-seeds.mjs";
import { parseCliOptions } from "./lib/cli.mjs";

const usage = `用法：node scripts/portfolio-project.mjs [--input-root <dir>]
把 data/sensitive/portfolio 的离线数据发布为公开投影（data/portfolio.sqlite 与图鉴/工具目录）。
  --input-root  离线输入根目录（默认 data/sensitive/portfolio）`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
} else {
  let inputRoot;
  let extra = [];
  try {
    const parsed = parseCliOptions(args, { "--input-root": "string" });
    inputRoot = parsed.inputRoot ?? DEFAULT_INPUT_ROOT;
    extra = parsed.positionals;
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exitCode = 2;
  }
  if (!process.exitCode && extra.length === 0) {
    const program = io("portfolio.seed-inputs", () => bootstrapPortfolioSeeds(inputRoot)).pipe(
      Effect.andThen(() => publishPortfolio({ inputRoot })),
    );
    runCli(program).then(
      (summary) => {
        console.log(
          `作品集公开投影完成：${summary.posts} 帖 / ${summary.media} 媒体（剔除隐藏 ${summary.hiddenDropped}），` +
            `图鉴 ${summary.layouts} 条（缺图 ${summary.layoutsMissing}），工具 ${summary.tools} 项。`,
        );
        console.log(`产物：${summary.database}`);
      },
      (error) => {
        console.error(`作品集公开投影失败：${error.message}`);
        process.exitCode = 1;
      },
    );
  } else if (extra.length > 0) {
    console.error(`未知参数：${extra.join(" ")}\n${usage}`);
    process.exitCode = 2;
  }
}
