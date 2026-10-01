import { Effect } from "effect";
const ANALYSIS_ENGINES = ["zcode", "codex-cli", "pi"];
export const DEFAULT_ANALYSIS_ENGINE = "pi";

export function resolveAnalysisEngine(value = DEFAULT_ANALYSIS_ENGINE) {
  if (!ANALYSIS_ENGINES.includes(value)) throw new Error("--engine 仅支持 zcode、codex-cli 或 pi。");
  return value;
}

export function resolveAnalysisConcurrency({ codex = 1, engine, override = null, pi = 15, zcode = 8 }) {
  const resolvedEngine = resolveAnalysisEngine(engine);
  const concurrency = override ?? (resolvedEngine === "codex-cli" ? codex : resolvedEngine === "zcode" ? zcode : pi);
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("并发数必须是大于 0 的整数。");
  return concurrency;
}

/** Effect owns bounded concurrency and interrupts sibling work on failure. */
export function runWorkerPool(count, concurrency, worker) {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(concurrency) || concurrency < 1) {
    return Effect.fail(new Error("任务数必须是非负整数，并发数必须是正整数。"));
  }
  return Effect.forEach(
    Array.from({ length: count }, (_, index) => index),
    worker,
    { concurrency, discard: true },
  );
}
