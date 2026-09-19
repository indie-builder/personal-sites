export const ANALYSIS_ENGINES = ["zcode", "codex-cli", "pi"];
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

/**
 * 固定并发的工作池：按索引把 count 个任务分发给至多 concurrency 个 worker。
 * worker 内部自行决定是否吞错；不吞错时首个错误会让整个池子 reject。
 */
export async function runWorkerPool(count, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (cursor < count) {
      const index = cursor;
      cursor += 1;
      await worker(index);
    }
  });
  await Promise.all(runners);
}
