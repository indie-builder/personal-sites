# Simplification audit — tools/content (scripts + lib) and packages/ (effect, public-data)

Scope: `tools/content/scripts/**` (1,941 lines incl. `scripts/lib`), `tools/content/lib` (65), `packages/effect/src` (136 + 100 .d.mts), `packages/public-data/src` (1,954 incl. `content.ts` + .d.mts). Read-only analysis; HEAD 5aca2c1. `tools/content/modules/**` belongs to another worker and was read only as import context.

**Bottom line: no dead code found in this slice. The scripts are already leaner than the brief assumed** — `parseCliOptions` / `atomic-file` / `json-file` already exist and are used. The real wins are one cross-boundary duplication (focus-status vs state store), bootstrap/config boilerplate, and two copy-paste pairs. Conservative net removable: **~55 lines** (gross ~75 before ~20 lines of new shared helpers).

---

## Summary (top 10 ranked)

| # | Finding | Net lines | Risk |
|---|---------|-----------|------|
| 1 | `focus-status.mjs` re-implements `createSupabaseAiNewsStateStore().health()` + `requireEnvironment` by hand | −18 | low |
| 2 | Shared script runner: 13× `repoRoot` boilerplate, 4× identical `runCli().catch` error blocks, 2 Effect-wrapped config reads | −10 net | low |
| 3 | Supabase service-client factory (`createClient` + auth options + env check triplicated) | −8 | low |
| 4 | `shortLinks` (recover) vs `extractShortLinks` (import-bird) — identical t.co extractor copy-pasted | −6 | low |
| 5 | `x-curation-prepare.mjs` hand-rolls `--source`/`--source-order-file` parsing instead of `parseCliOptions` | −5 | low |
| 6 | Feed-order sort comparator duplicated (build-curation-content vs public-sqlite) — **variants differ by id tiebreak** | −4 | med |
| 7 | `douyin-full-sync.mjs` `run()` 1:1 wrapper around `runCommand` — **but its `cwd=repoRoot` default is load-bearing** | −2 | med |
| 8 | `queue.version = Math.max(..., 3)` bump triplicated across queue writers | −2 | low |
| 9 | `compactPublicDatabase(database, minimumFreePages = 32)` — second param never passed by any caller | −1 | low |
| 10 | Dead code hunt: **zero** deletable scripts/exports in slice (all verified referenced) | 0 | — |

---

## Full findings table

| Category | Files | Evidence (file:line) | Est. lines removed | Risk | Suggested shape |
|----------|-------|----------------------|--------------------|------|-----------------|
| Cross-boundary duplication | `tools/content/scripts/focus-status.mjs`, `packages/public-data/src/ai-news/state.mjs` | focus-status.mjs:29-33 (raw `ai_news_sync_state` query) + 42-52 (ageMinutes/healthy/running shape) duplicates state.mjs:87-109 `health()` — same select string, same `<= 20` staleness, same field mapping | 15 (of focus-status's 72) | low | `const health = yield* createSupabaseAiNewsStateStore(client).health()` — shape already matches `DataHealth["aiNews"]` consumed by buildDataHealth (status.d.mts:11) |
| Cross-boundary duplication | focus-status.mjs, sync.mjs | `requiredEnvironment` focus-status.mjs:18-22 ≡ `requireEnvironment` sync.mjs:18-22 (5 lines, different error copy) | 4 | low | Export `requireEnvironment` from public-data (or fold into client factory, finding below) |
| Scaffolding | 13 scripts | `const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");` verbatim at x-curation-sync.mjs:27, x-curation-enrich.mjs:31, x-curation-prepare.mjs:32, x-curation-import-bird.mjs:27, recover-x-curation-queue.mjs:11, douyin-curation.mjs:25, douyin-full-sync.mjs:14, github-starred.mjs:27, build-curation-content.mjs:25, build-curation-sqlite.mjs:18, ai-news-sync.mjs:13, ai-news-archive.mjs:17, focus-status.mjs:15 | 13 | low | `export const repoRoot` in `scripts/lib/paths.mjs` (or the runner module) |
| Scaffolding | 4 scripts | Identical 5-line tail `runCli(main()).catch((error) => { console.error(\`…失败：${error.message}\`); process.exitCode = 1; })`: x-curation-sync.mjs:194-198, douyin-curation.mjs:269-273, douyin-full-sync.mjs:116-120, local-vectors.mjs:36-40 | 16 | low | `runScript(program, label)` in `@site/effect/cli` (or scripts/lib) wrapping runCli + uniform error print + exitCode=1. Also fixes inconsistency: x-curation-enrich.mjs:210-212 and ai-news-sync.mjs:34-36 use bare `await runCli(main())` (stack-trace failure output vs clean message in the other four) |
| Scaffolding | 2 scripts | Effect-wrapped config reads collapse: x-curation-enrich.mjs:34 and douyin-curation.mjs:263 each spend 3 lines on `io("…", async () => JSON.parse(await readFile(path.join(repoRoot, "config/…"), "utf8")))`; 7 more top-level 1-line reads (prepare:34, import-bird:28, build-content:26, build-sqlite:19+21, github-starred:28, sync:157) gain consistency but no lines | 4 | low | `readRepoJson(relativePath)` Effect helper next to `json-file.mjs` |
| Cross-boundary duplication | sync.mjs, ai-news-archive.mjs, focus-status.mjs (+ apps/web/lib/ai-news-sync.server.ts out of slice) | `createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })` at sync.mjs:122-126, ai-news-archive.mjs:20-22, focus-status.mjs:24-28 | 8 net (helper +8, remove ~16 across slice) | low | `createSupabaseServiceClient(env)` export in public-data; standardizes the auth-options triplet |
| Copy-paste pair | x-curation-import-bird.mjs, recover-x-curation-queue.mjs | `extractShortLinks` import-bird:39-46 vs `shortLinks` recover:22-28 — identical regex `/https?:\/\/t\.co\/\w+/gu`, identical `{original, expanded:null, type:"unexpanded"}` shape | 7 (delete recover's copy, +1 import) | low | Move one copy to `modules/x-sync/media.mjs` next to `normalizeXMedia` (both scripts already import from it) |
| Arg parsing bypass | x-curation-prepare.mjs | Hand-rolled `--source`/`--source-order-file` scan at lines 36-43 (8 lines incl. two `process.argv.find` passes) duplicates what `parseCliOptions` (cli.mjs:6-46) already does, including `--flag=value` form used by pipeline.mjs:54-55 | 5 | low | `parseCliOptions(args, { "--source": "string", "--source-order-file": "string" })`; keep the `bookmarks|likes|both` validation (prepare:44-46). CLI contract unchanged |
| Internal duplication | build-curation-content.mjs, modules/focus-sync/public-sqlite.mjs | Feed-order comparator: build-curation-content.mjs:40-45 vs `sortPublicFocusItems` public-sqlite.mjs:15-23 — same three keys, but public-sqlite adds `right.id.localeCompare(left.id)` tiebreak (line 21) | 4 | med | Export `sortPublicFocusItems` from public-sqlite and reuse — only if accepting that the generated JSON backup's tie order changes (id tiebreak added). Otherwise skip |
| Over-abstraction | douyin-full-sync.mjs | `function run(command, args, {cwd = repoRoot, env = {}} = {})` lines 19-21 is a 1:1 passthrough to `runCommand` — **but** the `cwd = repoRoot` default fires at line 72 (`run("pnpm", args)` with no options), and pnpm runs package scripts with cwd=tools/content, so dropping the default changes the child's cwd | 2 | med | Delete wrapper, call `runCommand` directly, pass `{ cwd: repoRoot }` explicitly at line 72. Failure mode if done blindly: `pnpm douyin:curation` child spawns in tools/content and manifest path resolution breaks |
| Internal duplication | 3 scripts | `queue.version = Math.max(Number(queue.version ?? 0), 3)` at x-curation-enrich.mjs:60, x-curation-prepare.mjs:110, x-curation-import-bird.mjs:151 | 2 | low | One `normalizeQueue(queue)` helper colocated with queue readers/writers; today the "3" invariant lives in three places |
| Speculative option | packages/public-data/src/sqlite.mjs | `compactPublicDatabase(database, minimumFreePages = 32)` — no caller passes page 2 (prod: public-sqlite.mjs:73, publish-to-sqlite.mjs:91; tests: public-sqlite-compaction.test.mjs:23,28) | 1 | low | Drop the parameter, hardcode 32 |
| .d.mts verdict | packages/*/src/*.d.mts | **Keep all.** apps/web/tsconfig.json:5 has `allowJs: false`, so web cannot infer from `.mjs` JSDoc; the 7 `.d.mts` files (effect: index/cli/schema; public-data: state/sync/archive/markdown-anchor/data-health×2) exactly mirror the apps/web import surface (verified: apps/web/lib/ai-news.ts, ai-news-sync.server.ts:6-7, ai-news-archive.server.ts:2, health routes, open-source-document-tabs.tsx:7). `sqlite.mjs`/`ask/search-index.mjs` have no `.d.mts` and no web consumers — deliberate, not an oversight | 0 | — | No change. Migrating to JSDoc-inferred types would require `allowJs` in web tsconfig — barred by the pinned TS7 setup |
| Test-support exports | scripts | `parseSyncArgs` (x-curation-sync.mjs:30), `parseArgs` (douyin-curation.mjs:27), `parseFullSyncArgs` (douyin-full-sync.mjs:29), `settleConcurrently` (douyin-curation.mjs:72), `buildAnalyzerArgs` (:91), `main` exports (enrich:32, ai-news-sync:15, douyin:260) — all consumed by tests/*.test.mjs (e.g. douyin-curation.test.mjs:21, cli.test.mjs:45) | 0 | — | Keep; these are the seam that lets tests import scripts without executing them |
| Deliberate non-finding | ai-news-archive.mjs | Hand-rolled copy→open→write→rename at lines 43-55 superficially resembles `atomic-file.mjs` but operates on an open SQLite handle (must `db.close()` before rename) — not absorbable by `writeTextAtomically` without a risky generic | 0 | — | Leave as is |

---

## Shared-runner analysis

What exists already (absorbs less than the brief hoped): `scripts/lib/cli.mjs` (50, table-driven parser used by 5 scripts + tests), `atomic-file.mjs` (25, Effect-based atomic write used by 7 scripts), `json-file.mjs` (11, ENOENT-tolerant read used by 6). No additional inlined helpers hiding in individual scripts beyond the items below — each script's remaining scaffolding is 1-3 lines, not blocks.

A `scripts/lib/runner.mjs` (or extensions to `@site/effect/cli`) worth ~25 lines absorbs:

1. **`repoRoot`** — 13 verbatim copies (evidence above).
2. **`runScript(program, label)`** — the 4 identical `runCli().catch` tails; also standardizes the 2 scripts that currently print raw stacks.
3. **`readRepoJson(path)`** — collapses the 2 Effect-wrapped config reads; makes the other 7 uniform.
4. **Optional: `createQueuePersister(queuePath, snapshot)`** — the Semaphore-guarded compact-JSON persist appears twice with a shared invariant (serialize-after-permit so concurrent completions can't save stale snapshots): x-curation-enrich.mjs:128-132, douyin-curation.mjs:203-211. Saves only ~2 net lines; its value is protecting the resume-critical write path behind one tested implementation.

Per-script conservative deltas:

| Script | Lines | Delta | What changes |
|--------|-------|-------|--------------|
| x-curation-sync.mjs | 198 | −7 | repoRoot, catch tail, config read in history branch (:157) |
| x-curation-enrich.mjs | 212 | −4 | repoRoot, config read (:34) |
| x-curation-prepare.mjs | 150 | −6 | repoRoot, parseCliOptions for --source (:36-43) |
| x-curation-import-bird.mjs | 207 | −1 | repoRoot (config read already 1 line) |
| recover-x-curation-queue.mjs | 126 | −8 | shortLinks dedup (:22-28), repoRoot |
| douyin-curation.mjs | 273 | −13 | repoRoot, config (:263), catch tail, persister share |
| douyin-full-sync.mjs | 120 | −5 | catch tail, run() wrapper removal w/ explicit cwd, repoRoot |
| github-starred.mjs | 205 | −1 | repoRoot |
| build-curation-content.mjs | 73 | −1 | repoRoot (comparator share optional +3) |
| build-curation-sqlite.mjs | 87 | −1 | repoRoot |
| local-vectors.mjs | 40 | −4 | catch tail (:36-40) |
| ai-news-sync.mjs | 36 | −1 | repoRoot |
| ai-news-archive.mjs | 56 | −1 | repoRoot; supabase factory −3 |
| focus-status.mjs | 72 | −21 | state-store health() (−15), env/client factory (−6) |
| **Gross** | | **−74** | |
| **New helpers** | | **+20** | runner ~12, readRepoJson ~5, shortLinks move 0, client factory +8 (counted in public-data, offsets) |
| **Net** | | **≈ −55** | |

What a runner must NOT absorb: the entrypoint guard itself differs deliberately — 6 scripts guard with `import.meta.url === new URL(\`file://${process.argv[1]}\`).href` because pipeline.mjs spawns them by path (pipeline.mjs:54,60,69,81,84,105-111); github-starred/prepare/import-bird/recover/build-* intentionally run at import top level (spawned as child processes, never imported). A uniform `main()`-with-guard refactor would change process isolation behavior — out of bounds for a no-behavior-change campaign.

---

## Cross-boundary duplication (tools/content vs packages/public-data)

1. **focus-status vs ai-news state store** (biggest item, finding #1): focus-status.mjs:29-33+42-52 re-implements state.mjs:87-109. Same Supabase select (`last_error,last_started_at,last_succeeded_at,lease_until`), same age/healthy/running math, same 20-minute threshold (focus-status:48 `<= 20` ≡ state.mjs:102 `ageMinutes <= staleAfterMinutes` default 20 at :87).
2. **Supabase client construction** ×3 in slice (sync.mjs:122-126, ai-news-archive.mjs:20-22, focus-status.mjs:24-28) — auth-options triplet copy-pasted; a factory in public-data serves apps/web too.
3. **env-var guard** — requiredEnvironment/requireEnvironment pair (above).
4. **Feed-order comparator** — build-curation-content.mjs:40-45 vs public-sqlite.mjs:15-23 (variants differ; med risk).
5. **SQLite open/pragma patterns** — NOT duplicated across the boundary: tools open via `new Database(...)` + `initializePublicDatabase` from public-data (public-sqlite.mjs:44, publish-to-sqlite.mjs:59); the archive db (`openArchive`, archive.mjs:14-27) is a separate schema used only by public-data + web. No shared code to extract.
6. **markdown/anchor helpers** — single source already: `createMarkdownHeadingId` lives in public-data (markdown-anchor.mjs:5) and is consumed by both search-index.mjs:1 and apps/web; tools/content never duplicates it.
7. **ai-news state/sync logic** — not copy-pasted anywhere; tools/content/scripts/ai-news-sync.mjs is a thin 36-line wrapper over `syncAiNews` (correct shape).

---

## CLI surface watchlist (names/args that must not change)

Verified referenced from root package.json, tools/content/package.json, docs/{supabase-x-sync,douyin-curation,github-starred-sync,ai-news-sync}.md, README.md, config/*.launchd.plist, .github/workflows/ai-news-sync.yml, and AGENTS.md:

- `pnpm curation:prepare|recover|import|fetch|history|sync|sync:glm|sync:luna|enrich|classify-design|build|publish` — x-curation-sync.mjs flags `--source --limit --engine --model --reasoning-effort --design-concurrency --no-media --fetch-only --history -h`; recover's `--force` (docs/supabase-x-sync.md:25); **x-curation-prepare's `--source=X` and `--source-order-file=X` are passed programmatically by pipeline.mjs:54-55** — any flag rename breaks the sync pipeline, not just humans.
- `pnpm douyin:curation -- sync --manifest <file> [--dry-run] [--refresh-only] [--limit n] [--engine …]` (usage text douyin-curation.mjs:54-60; `--analyzer-concurrency`, `--force` also accepted); `pnpm douyin:sync` flags `--discover-only --skip-download --skip-analyze --analyze-limit --dry-run --engine --concurrency --analyzer-concurrency`.
- `github-starred.mjs [init|daily|sync|analyze|publish|run] [--limit] [--concurrency] [--engine] [--only]` (usage github-starred.mjs:43).
- `ai-news-sync.mjs --backfill` (GitHub Actions + launchd); `ai-news-archive.mjs --prune [--apply]`; `focus-status.mjs --json`; `local-vectors.mjs index|search`.
- Note: `github:starred:run` and `curation:sync:luna` appear only in the two package.json files (no docs/workflow refs) but are plausibly manual entry points — do not delete without owner confirmation.
- Entry-script file paths are also a surface: pipeline.mjs spawns `scripts/x-curation-prepare.mjs`, `x-curation-enrich.mjs`, `build-curation-content.mjs`, `build-curation-sqlite.mjs`, `x-curation-import-bird.mjs` by absolute path.

---

## Dead code verification (negative result, evidence)

All 14 scripts referenced via tools/content/package.json scripts (lines 8-37), which are themselves wrapped 1:1 in root package.json (lines 31-57) and referenced from: README.md:62 (focus:status), docs/supabase-x-sync.md:25,39, docs/douyin-curation.md:82,85, docs/github-starred-sync.md:20, docs/ai-news-sync.md:23, .github/workflows/ai-news-sync.yml, config/ai-news-{sync,backfill}.launchd.plist, apps/web cron route. Exports: every public-data export has a consumer (rg sweep across apps/web, tools, tests — table above); every effect-package export (io, attempt, OperationError, runCli, UrlString, UtcDateTimeString, DateTimeString) is used by apps/web (curation-types.ts, curation-search.server.ts:1, open-source-schema.ts) or public-data (content.ts:1). `douyin-favorites-discover.py` is spawned by douyin-full-sync.mjs:81. Nothing in this slice is deletable as dead.
