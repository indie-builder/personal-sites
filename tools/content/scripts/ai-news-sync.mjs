#!/usr/bin/env node
import { Effect } from "effect";
import { attempt } from "@site/effect";
import { runCli } from "@site/effect/cli";
/** 同步上游 AI 资讯（精选 + 24 小时全部动态）到 Supabase；网站只读公开投影表。 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncAiNews } from "@site/public-data/ai-news/sync.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function main(args = process.argv.slice(2)) {
  return Effect.gen(function* () {
    yield* attempt("ai-news.env", () => loadLocalEnv(repoRoot));
    const backfill = args.includes("--backfill");
    const stats = yield* syncAiNews({ backfill });
    if (stats.skipped) {
      console.log("每日动态已有同步任务运行中，本次跳过。");
      return;
    }
    const parts = Object.entries(stats.modes).map(
      ([mode, modeStats]) =>
        `${mode === "selected" ? "精选" : "全部"} ${modeStats.changed ? `${modeStats.count} 条` : "无变化"}`,
    );
    console.log(
      `每日动态${backfill ? "七天回填" : "同步"}完成：${parts.join("，")}；公开投影写入 ${stats.publicCount} 条。`,
    );
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await runCli(main());
}
