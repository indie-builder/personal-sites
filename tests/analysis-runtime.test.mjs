import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ANALYSIS_ENGINE,
  resolveAnalysisConcurrency,
  resolveAnalysisEngine,
} from "../modules/analysis/runtime.mjs";

test("Pi BigModel is the shared default while CLI adapters remain explicit options", () => {
  assert.equal(DEFAULT_ANALYSIS_ENGINE, "pi");
  assert.equal(resolveAnalysisEngine(), "pi");
  assert.equal(resolveAnalysisEngine("pi"), "pi");
  assert.equal(resolveAnalysisEngine("codex-cli"), "codex-cli");
  assert.throws(() => resolveAnalysisEngine("other"), /仅支持 zcode、codex-cli 或 pi/u);
});

test("analysis concurrency follows the selected adapter and accepts an override", () => {
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "codex-cli", pi: 15 }), 40);
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "pi", pi: 15 }), 15);
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "zcode", zcode: 8 }), 8);
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "codex-cli", override: 8, pi: 15 }), 8);
});
