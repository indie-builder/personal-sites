import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareCurationItem } from "../modules/x-sync/analysis.mjs";

const cliUrl = new URL("../scripts/x-curation-enrich.mjs", import.meta.url);
const repoRoot = path.resolve(path.dirname(cliUrl.pathname), "../../..");
const configPath = path.join(repoRoot, "config/x-curation.json");

function fixtureItems() {
  const item = {
    author: { handle: "fixture", name: "Fixture" },
    fetchSource: "bookmarks",
    text: "Synthetic curation item",
    links: [
      { original: "https://t.co/fixture", type: "unexpanded" },
      { original: "https://github.com/example/fixture", expanded: "https://github.com/example/fixture", type: "github" },
      { original: "https://example.com/article", expanded: "https://example.com/article", type: "article" },
    ],
    media: [{ type: "photo", url: "https://example.com/image.png" }],
  };
  return [
    { ...item, id: "pending", ai: {} },
    { ...item, id: "enriched", ai: { enrichedAt: "2026-01-01T00:00:00Z" } },
    { ...item, id: "old-design", ai: { enrichedAt: "2026-01-01T00:00:00Z", design: { relevant: true, status: "unclassified" } } },
  ];
}

const cases = [
  { name: "normal", args: [], ids: ["pending"] },
  { name: "design-only", args: ["--design-only"], ids: ["enriched"] },
  { name: "refresh", args: ["--refresh"], ids: ["pending", "enriched", "old-design"] },
  { name: "design refresh", args: ["--design-only", "--refresh"], ids: ["enriched", "old-design"] },
  { name: "filtered and limited", args: ["--refresh", "--only=enriched,old-design", "--limit=1"], ids: ["enriched"] },
  { name: "zero targets", args: ["--only=missing"], ids: [] },
];

for (const normalized of [false, true]) {
  for (const scenario of cases) {
    test(`dry-run ${scenario.name} leaves ${normalized ? "normalized" : "legacy"} queue bytes and adapters untouched`, async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "site-enrich-dry-run-"));
      const queuePath = path.join(directory, "queue.json");
      const items = fixtureItems().map((item) => normalized
        ? prepareCurationItem({ ...item, ai: item.ai.design ? { ...item.ai, design: { ...item.ai.design, status: "include" } } : item.ai }, { now: new Date("2026-01-01T00:00:00Z") })
        : item);
      const bytes = `${JSON.stringify({ version: normalized ? 3 : 1, items }, null, 2)}\n`;
      const key = `enrichTest_${normalized}_${scenario.name.replaceAll(" ", "_")}`;
      const logs = [];
      const reads = [];
      const externalCalls = [];
      let envLoads = 0;
      const state = {
        readFile: async (filePath, encoding) => {
          reads.push(filePath);
          if (filePath === configPath) return JSON.stringify({ queueFile: path.relative(repoRoot, queuePath), taxonomy: [] });
          assert.equal(filePath, queuePath, "only the synthetic queue can be read");
          return readFile(queuePath, encoding);
        },
        loadLocalEnv: () => { envLoads += 1; },
        resolvePiModelConfig: () => ({ provider: "fixture", model: "fixture" }),
        forbidden: (name) => () => {
          externalCalls.push(name);
          assert.fail(`dry-run invoked external adapter: ${name}`);
        },
      };
      const mockExports = new Map([
        ["node:fs/promises", ["readFile"]],
        ["../../../scripts/lib/load-local-env.mjs", ["loadLocalEnv"]],
        ["../lib/pi-runtime.mjs", ["resolvePiModelConfig"]],
        ["../modules/analysis/readers.mjs", ["createAnalysisReader"]],
        ["../modules/x-sync/link-content.mjs", ["expandUrl", "classifyUrl", "fetchGithubRepo", "fetchArticleText"]],
        ["../modules/x-sync/design-media.mjs", ["collectDesignEvidenceImages"]],
        ["../modules/x-sync/prompts.mjs", ["buildPrompt", "buildDesignPrompt", "parseJsonResponse", "parseDesignResponse"]],
        ["./lib/atomic-file.mjs", ["writeTextAtomically"]],
      ]);
      const sources = new Map();
      for (const [specifier, names] of mockExports) {
        const url = `site-enrich-test:${key}/${encodeURIComponent(specifier)}`;
        sources.set(url, names.map((name) =>
          `export const ${name} = globalThis[${JSON.stringify(key)}].${Object.hasOwn(state, name) ? name : `forbidden(${JSON.stringify(name)})`};`,
        ).join("\n"));
      }
      const originalArgs = process.argv;
      const originalLog = console.log;
      const originalFetch = globalThis.fetch;
      let hooks;
      try {
        await writeFile(queuePath, bytes);
        globalThis[key] = state;
        globalThis.fetch = state.forbidden("fetch");
        console.log = (...values) => logs.push(values.join(" "));
        process.argv = [process.execPath, cliUrl.pathname, "--dry-run", ...scenario.args];
        hooks = registerHooks({
          resolve(specifier, context, nextResolve) {
            if (context.parentURL?.startsWith(cliUrl.href) && mockExports.has(specifier)) {
              return { url: `site-enrich-test:${key}/${encodeURIComponent(specifier)}`, shortCircuit: true };
            }
            return nextResolve(specifier, context);
          },
          load(url, context, nextLoad) {
            if (sources.has(url)) return { format: "module", source: sources.get(url), shortCircuit: true };
            return nextLoad(url, context);
          },
        });
        // Import only after all module-scope config/environment and I/O adapters are mocked.
        await import(`${cliUrl.href}?${key}`);
        assert.equal(await readFile(queuePath, "utf8"), bytes);
        assert.deepEqual(reads, [configPath, queuePath]);
        assert.equal(envLoads, 1);
        assert.deepEqual(externalCalls, []);
        const previews = logs.filter((line) => line.startsWith("[dry-run]"));
        assert.deepEqual(previews.map((line) => line.split(" ")[1]), scenario.ids);
        assert.ok(logs.some((line) => line.includes(`: ${scenario.ids.length} 条`)));
        for (const preview of previews) {
          assert.match(preview, /现有链接类型 unexpanded、github、article，未展开 1\/3，媒体 1；计划：/u);
          assert.match(preview, scenario.args.includes("--design-only") ? /补设计分类/u : /展开 1 条短链、抓取 2 条已解析链接/u);
        }
      } finally {
        hooks?.deregister();
        console.log = originalLog;
        process.argv = originalArgs;
        globalThis.fetch = originalFetch;
        delete globalThis[key];
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
