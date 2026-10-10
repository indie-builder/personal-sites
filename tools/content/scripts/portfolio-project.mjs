import { Effect } from "effect";
import { runCli } from "@site/effect/cli";

import { publishPortfolio } from "../modules/portfolio/project.mjs";

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input-root");
const inputRoot = inputIndex >= 0 ? args[inputIndex + 1] : undefined;

runCli(publishPortfolio({ inputRoot })).then(
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
