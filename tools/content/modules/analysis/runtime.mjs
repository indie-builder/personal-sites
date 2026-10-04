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
