# Test-suite simplification ledger — personal-sites

Scope read in full: `apps/web/tests` (34 test files + 1 support, ~2,723 lines), `apps/web/e2e` (21 specs + 1 helper, 1,504 lines), `tools/content/tests` (17 files + 1 type-contract file, ~2,569 lines), `packages/effect/tests` + `packages/public-data/tests` (~984 lines). Total ≈ 7,780 lines. Root-level `tests/` and `e2e/` were ignored per instructions. Every claim below cites file:line actually read; source was opened where needed to judge the guard.

## Summary (top 10 ranked by value/risk)

| # | Move | Files | Est. lines removed | Risk | Surviving guard |
|---|------|-------|-----|------|-----------------|
| 1 | Shared CLI-mock harness for the 4 copy-pasted `registerHooks` blocks | tools/content/tests/{douyin-curation,x-curation-enrich,cli,bigmodel}.test.mjs | ~55 | med | Same assertions, helper-owned scaffolding |
| 2 | Table-drive the 9 fallback tests | apps/web/tests/use-stream-feed.test.ts | ~38 | low | One `it.each` stating the full fallback taxonomy |
| 3 | Shared `motion/react` jsdom mock | apps/web/tests/{dot-field-parallax,opening-loader,x-video-player,profile-introduction} | ~40 | med | Same observable assertions per component |
| 4 | Drop e2e identity-persistence dup (covered by vitest) | apps/web/e2e/assistant-drawer.spec.ts:78-102 | ~25 | low-med | vitest ask-chat-resilience.test.tsx:55-73,196-213 |
| 5 | Local helper for the 4× storage-failure spy blocks | apps/web/tests/profile-transition-state.test.ts | ~22 | low | Same it.each cases, helper-owned spies |
| 6 | Rewrite ghost-ordering test to observable geometry | apps/web/tests/profile-transition-state.test.ts:124-149 | ~16 | low | Ghost count + ghost rects match source rects |
| 7 | Shared Playwright auto-fixture for the loader-key init | apps/web/e2e (6 specs) + helpers/assistant.ts | ~18 | low | Fixture applied globally |
| 8 | Table-drive the 3 JSON-502 error-contract tests | apps/web/tests/x-media-route.test.ts:59-104 | ~15 | low | One `it.each` over {upstream failure, timeout, redirect-escape} |
| 9 | Trim per-controls `animate.stop` call-count assertions | apps/web/tests/profile-transition-state.test.ts:35-40,95-101 | ~10 | med | DOM-level assertions (ghosts=0, dataset flags cleared) at 41-42,102-104 |
| 10 | Rewrite mocked `useMotionValue.set` sequence assertions | apps/web/tests/dot-field-parallax.test.tsx:86-89,104-105 | ~12 | med | Measure-once + reduced-motion-no-op behavior via observable spies |

**Conservative net removable: ~255 lines (≈3.3% of 7,780).** This suite is already lean and mostly behavioral; the big wins are scaffolding dedup and table-driving, not deletion. No behavior should become unguarded if every row keeps its named survivor.

## Full findings table

### 1. Coverage overlap (vitest vs e2e, or two vitest files)

| ID | Overlap | Evidence | Classification | Est. lines | Risk | Surviving guard |
|----|---------|----------|----------------|-----|------|-----------------|
| O1 | Ask visitor/conversation identity persistence across reopen asserted twice | vitest `apps/web/tests/ask-chat-resilience.test.tsx:55-73` (unmount/remount, UUID shape, visitor≠conversation) and e2e `apps/web/e2e/assistant-drawer.spec.ts:78-102` (drawer close/reopen, same three assertions) | **keep-vitest-drop-e2e** — the vitest version is strictly stronger (also covers the storage-blocked in-memory fallback at 75-95, which e2e cannot); the e2e copy adds only "real browser storage works", trivially equivalent to jsdom here | 25 | low-med | ask-chat-resilience.test.tsx:55-73 + 196-213 |
| O2 | "检索范围/清空对话 buttons retired" asserted in both suites | vitest ask-chat-resilience.test.tsx:206,212 (2 one-line assertions inside larger tests); e2e retired-ask.spec.ts:13 (3 widths) | genuinely-different surfaces; keep both — 3 lines total, not worth touching | 0 | — | both |
| O3 | Curation/design detail canonical + OG card | vitest curation-entry-metadata.test.ts:15-55 (calls `generateMetadata` directly, asserts full metadata object incl. twitter card + RSS types); e2e entry-metadata.spec.ts:16-30 (rendered `<link canonical>`, og:*) | **genuinely-different layering** — e2e comment (entry-metadata.spec.ts:3-5) documents the page-level og:image-override regression only visible rendered; keep both | 0 | — | both |
| O4 | Curation tag filtering | vitest curation-tags.test.ts:9-37 (lib counts/headId/pagination per tag); e2e curation-tags.spec.ts:3-49 (menu UI at 4 widths, first-entry match vs API) | genuinely-different (lib vs rendered UI); keep both. See T3 for a runtime/over-assertion trim | 0 | — | both |
| O5 | Ask OpenUI markdown streaming + sources-after-done | vitest ask-chat-resilience.test.tsx:97-146; e2e ask-flow.spec.ts:108-156 (4 viewports, tabs, CSS, no-overflow, 16px input) | genuinely-different emphasis — e2e owns CSS/layout/tabs/keyboard; vitest owns stop/error/retry/malformed flows e2e lacks; keep both | 0 | — | both |
| O6 | Stream load-more failure fallback | vitest use-stream-feed.test.ts (function-level failure taxonomy); e2e stream-load-more-resilience.spec.ts:8-88 (scroll→502→retry→append loop, design section copy) | genuinely-different; keep both | 0 | — | both |
| O7 | open-source filter journey appears in 2 e2e specs | open-source-filter.spec.ts:3-43 (menu behavior, 4 widths) vs open-source-motion.spec.ts:3-40 (same navigation+filter, asserts animation durations) | genuinely-different assertions on a shared journey; optional merge would save ~12 nav lines but couple a flaky motion instrument to the stable menu spec — not recommended now | (12) | med | keep both |

Verdict on the vitest/e2e boundary: healthy. Exactly one true duplication (O1). Everything else layers correctly (logic in vitest, browser-only properties in e2e).

### 2. Implementation-coupled tests (refactor blockers — see dedicated section)

| ID | Test | Evidence | Blocks | Est. lines | Risk |
|----|------|----------|--------|-----|------|
| I1 | Ghost measurement/append ordering | profile-transition-state.test.ts:124-149 — asserts call order `["read-avatar","read-summary","append"]` and `appendSpy.mock.calls[0]).toHaveLength(3)` | Any refactor of `beginProfileTransition` internals: DocumentFragment, offset* measurement, different ghost count | 16 | low |
| I2 | `animate` mock stop-call counts | profile-transition-state.test.ts:35-40 (`controls.stop` each), 95-101 (`toHaveLength(3)` + stop each) | Switching ghost animation off `motion/react animate` (WAAPI/CSS) | 10 | med |
| I3 | Mocked `useMotionValue.set` sequences | dot-field-parallax.test.tsx:86-89 (`toHaveBeenNthCalledWith(1,0)/(2,6)`), 104-105 | Refactoring DotFieldParallax to transform styles or springs | 12 | med |
| I4 | Exact DOM structure counts | interactive-dot-field.test.ts:8-18 (6 lanes / 6 tracks / 6 repeat / 12 terms / 4+4 align) | Any markup or lane-count change in InteractiveDotField; it is the only guard that reduced-motion static terms exist | (keep) | — |
| I5 | Animation-count state stepping | profile-introduction.test.tsx:92,98 (`toHaveLength(1)/(2)`) | Changing the typewriter's number of animate calls; acceptable as a driving mechanism since observable assertions (111-114) coexist | (keep) | — |
| I6 | Exact ms-duration pins in e2e | open-source-motion.spec.ts:28 (`fill(280)`), profile-motion.spec.ts:68,78 (`===120`), section-navigation.spec.ts:22,36 (`[]`) | Motion-token tuning (motion-tokens.ts); intentional contract — change token and test together | (keep) | — |
| I7 | Exact argv arrays for pipeline stages | tools/content/tests/x-curation-sync.test.mjs:20-63,193-227 — full `assert.deepEqual(calls, [...])` per stage | Pipeline refactors (arg rename, stage split); it is the command-line contract, so coupling is the point; keep | (keep) | — |

### 3. Duplicate scaffolding → one shared helper

| ID | Duplication | Evidence | Shared helper | Est. lines | Risk |
|----|-------------|----------|---------------|-----|------|
| S1 | loader-key `addInitScript` beforeEach copy-pasted | assistant-drawer.spec.ts:3-6; ask-scroll-to-latest.spec.ts:4-8; curation-detail-responsive.spec.ts:3,6-8; detail-touch-targets.spec.ts:3,7-9; layout-input-regressions.spec.ts:3,5-7; retired-works.spec.ts:4 (helpers/assistant.ts:4 already centralizes it for the ask specs) | `test.extend` auto-fixture in e2e/helpers | 18 | low |
| S2 | `motion/react` jsdom mock boilerplate | dot-field-parallax.test.tsx:7-52; opening-loader.test.tsx:8-51; profile-introduction.test.tsx:7-43; x-video-player.test.tsx:8-12 | tests/support/motion-mock.ts with per-file state config | 40 | med |
| S3 | sessionStorage-failure spy blocks repeated | profile-transition-state.test.ts:47-56, 63-71, 81-94, 108-110 — same `vi.spyOn(window,"sessionStorage","get")` / `Storage.prototype` throw setup 4× | local `stubStorageFailure(mode)` in that file | 22 | low |
| S4 | CLI `registerHooks` module-mock harness copy-pasted | douyin-curation.test.mjs:243-267; x-curation-enrich.test.mjs:17-48 (+243-246); cli.test.mjs:29-43; bigmodel.test.mjs:97-114 — each re-implements resolve/load short-circuit + globalThis state | tools/content/tests/helpers/cli-mock.mjs | 55 | med |

### 4. Stale tests

None found. Verified against source: security headers exist (`apps/web/next.config.*:25-37`); portfolio href matches (`apps/web/components/site-profile.tsx:50`); 检索范围/清空对话 genuinely absent from components (only a user-facing string at `apps/web/app/api/ask/route.ts:63`); `herdr`/`not-starred` present in `config/open-source-curation.mjs:105-113`; retired-routes specs assert live 404s so they cannot silently go stale. Two brittle-by-design data pins to be aware of (not stale): curation-tags.test.ts:12-22 hardcodes the top-9 tag names against the bundled projection; open-source.test.ts:10-11 pins `openSourceEntries` length 10. These break on content churn intentionally.

### 5. Over-assertion → table-driven consolidation

| ID | File | Evidence | Consolidation | Est. lines | Risk |
|----|------|----------|---------------|-----|------|
| T1 | use-stream-feed.test.ts | lines 40-118: nine structurally identical `it("…回落兜底文案")` tests differing only in the mocked Response | one `it.each([{name, respond}]…)` table (~11 rows) + shared runner | 38 | low |
| T2 | x-media-route.test.ts | lines 59-104: redirect-escape / upstream-fail / timeout / HEAD all assert the same JSON-502 contract | `it.each` over failure mode + expected status/body | 15 | low |
| T3 | curation-tags.test.ts | lines 23-36: loops 9 tags × 3 full-corpus reads (up to 10,000-item queries) to assert count/headId/pagination; taxonomy-injection logic is already fully table-tested at the source in tools/content x-curation-analysis.test.mjs:57-82 | loop 4 representative tags (parent 提示词, two subtypes, 技能) | 6 (+ large runtime) | low |

### 6. e2e journey duplication

Only O1 (identity persistence) is a true journey duplicate — see table. Ask-flow appears across 5 specs but each owns a distinct property (SSE rendering/CSS, scroll-to-latest target size, drawer layout/focus-trap, sprite motion, retirement). Curation-detail-responsive vs curation-tags overlap nowhere (spread layout vs filter menu). No consolidation beyond O1 recommended.

## Coverage map (source area → guarding tests)

Legend: **[V]** vitest, **[E]** e2e, **[T]** tools/content node:test, **[P]** packages node:test. ⚠ = area whose only unit guard is implementation-coupled.

### apps/web/components
- **ask family** (ask-chat, ask-chat-snapshot, ask-answer, ask-message, ask-sse, ask-assistant, use-ask-conversation): V ask-chat-resilience; E ask-flow, assistant-drawer, ask-scroll-to-latest, assistant-motion, retired-ask — strong.
- **profile-transition-state / bridge / mobile-profile-collapse**: ⚠ V profile-transition-state (mock-call-count heavy); behavioral guard lives in E profile-motion.spec.ts:38-125 (bridge durations, state cleared, storage-write failure). Unit coverage weakest here.
- **profile-introduction / profile-typewriter / assistant-sprite**: V profile-introduction (partially coupled I5); E assistant-motion.spec.ts:10-148 (strong behavioral: coordinate origin, jump landing, enter-after-intro, resume-after-close).
- **opening-loader / opening-reveal**: V opening-loader (behavioral: session-once, leave timing); E only asserts its absence — fine.
- **interactive-dot-field**: ⚠ V interactive-dot-field (DOM counts, I4); E profile-motion.spec.ts:127-142 (offscreen pause). Keep at least one.
- **dot-field-parallax**: ⚠ V only (mocked motion values, I3). No e2e guard. Weakest component.
- **focus-stream-error-boundary**: V only — behavioral (roles, focus restore, rAF retry). Good.
- **curation-stream / use-stream-feed / stream-snapshot / use-stream-date**: V use-stream-feed + stream-snapshot (table-driven over both snapshots); E stream-load-more-resilience, home-streaming.
- **curation-scroll**: V curation-scroll only (behavioral through mocked IntersectionObserver); E exercises the sentinel end-to-end in stream-load-more.
- **curation-entry**: V curation-entry-metadata; E curation-isr (ISR HIT/MISS + nav), entry-metadata (rendered canonical/OG).
- **open-source-document-view / tabs / repository-browser**: V open-source-document-view (roving focus, URL share); E detail-touch-targets, open-source-motion (repository loading).
- **x-video-player / x-app-link**: V x-video-player (preload/autoplay/muted/error recovery), x-app-link. No e2e (proxy covered by route test).
- **about-print / growing-paragraph / page-shell / section-motion-lifecycle / section-navigation-link / site-profile / theme-toggle / ui/**: E only (profile-motion about-receipt, section-navigation, layout-input-regressions, curation-detail-responsive dark theme). growing-paragraph and page-shell have no dedicated guard anywhere — indirect page-level e2e only.

### apps/web/lib + app routes
- ai-news (lib + archive + supabase merge + sitemap): V ai-news-hybrid (one strong integration test), ai-news, ai-news-detail-route, ai-news-cron-route; E ai-news-filter (list route via UI), public-discovery (health/archive endpoints).
- ask server (session/search/limiter/terms/route): V ask-session-effect, ask-search-ranking, ask-search-quality (integration vs bundled index), ask-search-terms, ask-shared-rate-limiter, ask-format-route.
- curation (lib/types/format): V curation-tags, douyin-curation-split, curation-media-alt (integration vs bundled sqlite).
- open-source (lib/types/schema/github-readme-url/github-repository-browser): V open-source, open-source-api. `github-repository.server.ts` has no direct test (minor gap; e2e open-source-motion covers the tree route it feeds).
- paginated-route: V paginated-route (factory used by ai-news/design/douyin list routes — those inherit coverage).
- x-media route: V x-media-route. security headers: V security-headers (verified live). metadata.ts: via curation-entry-metadata + E entry-metadata. opengraph-image: V opengraph-image + E public-discovery.

### tools/content
- douyin-sync: T douyin-curation (projection, prompts, CLI harness, worker pool).
- x-sync: T x-curation-sync (pipeline argv), x-curation-analysis (facts/tags/insights), x-curation-projection (public item + public-sqlite + ask index), x-curation-enrich (CLI dry-run matrix + retry), x-curation-media, x-design-classification. link-content.mjs only via `classifyUrl` (x-curation-analysis.test.mjs:31-36) and CLI mocks — expand/fetch adapters untested directly.
- github-starred: T source (retry taxonomy, incremental sync), reading (translation chunking/retry, codex reader), publish (sqlite projection, duplicate rejection, withdrawal).
- analysis: T analysis-runtime, bigmodel (provider + image contract), x-curation-enrich (retry), agent-response; github-starred-reading (model timeout).
- local-vectors algorithms: T local-vectors. scripts/lib: T cli, atomic-file, json-file.
- **Untested scripts** (gaps, not deletions): focus-status.mjs, local-vectors.mjs (script), recover-x-curation-queue.mjs, ai-news-archive.mjs (script; package module tested), build-curation-content.mjs, build-curation-sqlite.mjs, x-curation-prepare.mjs, x-curation-import-bird.mjs, github-starred.mjs main. These are only invoked (argv-asserted) by x-curation-sync tests.

### packages/public-data
- ai-news/sync: P ai-news-sync (projection, pagination/etag, stale-flag reset, lease, interruption).
- ai-news/archive: P ai-news-archive + V ai-news-hybrid.
- ai-news/state.mjs (111 lines): **no direct test** — only mocked in data-health-route.test.ts. Weakest package area.
- ask/search-index: P ask-search-index + retired-works (CHECK constraints + published-db health).
- data-health sqlite/status: P data-health (15-case table + failure cleanup) — excellent.
- sqlite.mjs: P retired-works, public-sqlite-compaction.
- markdown-anchor.mjs (17 lines): no direct test; indirectly via ask-search-index anchor URLs and open-source-document-tabs usage.

### packages/effect
- index/io/attempt/schema: P runtime + io-contracts (type-level). cli.mjs: runtime SIGTERM test + T cli.test.

## Refactor blockers (implementation-coupled → replacement behavioral assertion)

1. **profile-transition-state.test.ts:124-149** (ordering + append arity). Blocks: DocumentFragment/offset* measurement, ghost-count changes in `beginProfileTransition`. Replace with: after `beginProfileTransition`, `document.querySelectorAll(".profile-transition-ghost")` count and each ghost's `getBoundingClientRect()` equal the source element's rect (geometry is the user-visible contract).
2. **profile-transition-state.test.ts:35-40,95-101** (animate `.stop` counts). Blocks: moving ghosts off `motion/react animate`. Replace with: keep the DOM assertions (ghosts removed, `dataset.profileFeedHold`/`profileTransition` cleared — lines 41-42,102-104 already assert these) and keep at most ONE stop-on-replacement assertion as a CPU-leak proxy.
3. **dot-field-parallax.test.tsx:86-89,104-105** (mocked motion-value set sequences). Blocks: transform-style or spring refactor of DotFieldParallax. Replace with: render the parallax layer with a mock that applies `style` (pass-through instead of delete) and assert the layer's `transform` after pointer moves, and `getBoundingClientRect` call counts (already observable). If jsdom cannot express it, promote to an e2e pointer-move transform check and delete the mock-sequence assertions.
4. **interactive-dot-field.test.ts:8-18** (exact counts 6/6/6/12/4/4). Blocks: markup/lanes redesign. It is the only guard that reduced-motion static terms render — if the component is ever redesigned, replace with: `[data-static-term]` present under reduced motion and lanes present otherwise, or an e2e reduced-motion snapshot assertion.
5. **x-curation-sync.test.mjs:20-63,193-227** (exact argv per stage) and **x-curation-enrich.test.mjs:126-129** (exact preview-log regexes). Intentional CLI/copy contracts; any pipeline or copy refactor must update these in lockstep — flagging so the campaign treats them as contracts, not cruft.

## Bottom line

Conservative net removable ≈ **255 lines** (≈3.3%): ~110 from scaffolding dedup (S1-S4), ~75 from table-driving (T1-T3), ~45 from implementation-coupled rewrites that keep behavior guarded (I1-I3), ~25 from the single true e2e/vitest duplication (O1). No stale tests found. The suites that must survive untouched: data-health.test.mjs, ai-news-hybrid.test.ts, ask-chat-resilience.test.tsx, ask-session-effect.test.ts, github-starred trio, x-curation-analysis/projection, paginated-route.test.ts, and every e2e spec guarding browser-only properties (motion, layout, touch, ISR, a11y) — they have no vitest substitute.
