#!/usr/bin/env node
import { runCli } from "@site/effect/cli";
import { Effect } from "effect";
import { attempt, io, OperationError } from "@site/effect";
/** 本地 X 策展队列解析；原始队列仅留在 data/sensitive。 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createAnalysisReader } from "../modules/analysis/readers.mjs";
import { enrichQueue } from "../modules/x-sync/enrich.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";
import { resolveAnalysisConcurrency, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import { parseCliOptions } from "./lib/cli.mjs";
import { repoRoot } from "./lib/repo-root.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

export function main(args = process.argv.slice(2)) {
  return Effect.gen(function* () {
    const config = yield* io("curation.config", async () => JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8")));
    const queuePath = path.join(repoRoot, config.queueFile);
    yield* attempt("curation.env", () => loadLocalEnv(repoRoot));
    const piModel = yield* attempt("curation.model", () => resolvePiModelConfig({ config, env: process.env }));
    const cli = yield* attempt("curation.options", () => parseCliOptions(args, {
      "--concurrency": "int",
      "--design-only": "flag",
      "--dry-run": "flag",
      "--engine": "string",
      "--limit": "int",
      "--model": "string",
      "--only": "csv",
      "--refresh": "flag",
      "--reasoning-effort": "string",
    }));
    const DRY_RUN = cli.dryRun ?? false;
    const DESIGN_ONLY = cli.designOnly ?? false;
    const REFRESH = cli.refresh ?? false;
    const ENGINE = yield* attempt("curation.engine", () => resolveAnalysisEngine(cli.engine));
    const CODEX_MODEL = cli.model ?? "gpt-5.6-luna";
    const CODEX_REASONING_EFFORT = cli.reasoningEffort ?? "max";
    const LIMIT = cli.limit ?? Infinity;
    const CONCURRENCY = yield* attempt("curation.concurrency", () => resolveAnalysisConcurrency({ engine: ENGINE, override: cli.concurrency ?? null }));
    const ONLY = cli.only ?? null;

    const reader = Effect.gen(function* () {
      if (ENGINE === "pi" && !process.env.BIGMODEL_API_KEY) {
        return yield* Effect.fail(new OperationError("curation.config", new Error("缺少 BIGMODEL_API_KEY 环境变量，Pi 无法使用 智谱 GLM Coding 模型。")));
      }
      return yield* createAnalysisReader({
        engine: ENGINE,
        config: {
          ...config,
          analysis: { ...config.analysis, codex_cli: { model: CODEX_MODEL, reasoning_effort: CODEX_REASONING_EFFORT } },
        },
        repoRoot,
        timeoutMilliseconds: ENGINE === "pi" ? null : undefined,
      });
    });
    const MODEL_LABEL =
      ENGINE === "codex-cli"
        ? `codex-cli/${CODEX_MODEL}`
        : ENGINE === "zcode"
          ? "zcode/GLM-5.3-Flash"
          : `pi/${piModel.provider}/${piModel.model}`;

    const result = yield* enrichQueue({
      queuePath, taxonomy: config.taxonomy, modelLabel: MODEL_LABEL,
      dryRun: DRY_RUN, designOnly: DESIGN_ONLY, refresh: REFRESH,
      only: ONLY, limit: LIMIT, concurrency: CONCURRENCY,
    }, {
      reader,
    });
    if (result.failed > 0) process.exitCode = 1;
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await runCli(main());
}
