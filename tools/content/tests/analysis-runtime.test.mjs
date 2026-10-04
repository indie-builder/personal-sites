import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";

import { createAnalysisReader } from "../modules/analysis/readers.mjs";
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

test("analysis reader selects the requested CLI adapter and keeps its model configuration", async () => {
  const codex = await Effect.runPromise(
    createAnalysisReader({
      engine: "codex-cli",
      config: { analysis: { codex_cli: { model: "codex-mini" } } },
      repoRoot: "/project",
    }),
  );
  const zcode = await Effect.runPromise(
    createAnalysisReader({
      engine: "zcode",
      config: { analysis: { zcode: { model: "glm-test" } } },
      repoRoot: "/project",
    }),
  );
  assert.deepEqual(codex.modelConfig, { model: "codex-mini", provider: "codex-cli" });
  assert.deepEqual(zcode.modelConfig, { model: "glm-test", provider: "zcode" });
  await assert.rejects(Effect.runPromise(createAnalysisReader({ engine: "unknown", repoRoot: "/project" })), /仅支持/u);
});
