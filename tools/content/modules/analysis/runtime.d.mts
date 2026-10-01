import type { Effect } from "effect";
export type AnalysisEngine = "codex-cli" | "pi" | "zcode";

export const DEFAULT_ANALYSIS_ENGINE: AnalysisEngine;
export function resolveAnalysisEngine(value?: string): AnalysisEngine;
export function resolveAnalysisConcurrency(options: {
  codex?: number;
  engine: AnalysisEngine;
  override?: number | null;
  pi?: number;
  zcode?: number;
}): number;

export function runWorkerPool<E>(
  count: number,
  concurrency: number,
  worker: (index: number) => Effect.Effect<unknown, E>,
): Effect.Effect<void, E | Error>;
