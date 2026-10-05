# Judge verdict table (final, delivered 2026-10-05; reviewed against 5aca2c1 == 656d950 tree)

Verdicts: CONFIRMED / ADJUSTED (viable with corrections) / REJECTED (out of campaign).

## Web components (U1)
- Shared StreamFilterMenu — ADJUSTED. Radix structure shared, but AI news trigger says 精选 while option says 精选动态; open-source counts only in options. Keep per-caller selection logic, dynamic aria-label (pass the FULL caller-generated label into the shared component, never derive from option labels — pinned by e2e/curation-tags.spec.ts:8, e2e/ai-news-filter.spec.ts:6, e2e/open-source-filter.spec.ts:11), extra menu class, modal={false}, positioning, indicator slots.
- profile-introduction dedupe — ADJUSTED. resetTitleToChinese ≡ showChinese: share. typeTitle/typeGreeting have separate Effect lifecycle closures, drivers, cancellation flags: share only with driver+cancellation supplied per lifecycle; do not create changing helper deps that restart the sequence. −12 overstated.
- isBox predicate — ADJUSTED. Factor the finite-field checks equivalently: all four named fields via Number.isFinite; NO coercion, NO nonnegative constraints. The claimed invalid-payload test does NOT exist (test line 57 is storage failure): ADD a small malformed-payload guard test BEFORE the source change.
- Shared StreamStatus + skeleton — ADJUSTED. Loading/error/retry fragments match. Footers differ: curation uses li, ai-news uses div + unconditional sr filter announcement. Loading/error/completion are independent conditions — an exclusive status switch changes rendering. Share the three skeleton spans; keep wrappers' ARIA; do not pull the server page shell (page-shell.tsx:13, ai-news/loading.tsx:10) into the client bundle.
- fetchRepositoryJson merge — ADJUSTED. Bodies match after parameterizing URL/type/fallback. Preserve Effect operation names, Effect-provided AbortSignal, tree unmount cancellation, file request-version checks, error ?? fallback. Helper must return an Effect / stay within io adapters. ~10 is gross, not net.
- growing-paragraph dead branch — CONFIRMED. Keep animation, observer cleanup, cancellation, height restoration.
- open-source useStreamDate misuse — CONFIRMED. Split the existing sticky-offset effect from the hook; use only that half in open-source. Removes wasted listeners; not a line-reduction claim.
- SECTION_BY_CONTEXT ternary — REJECTED. Already a registry; remaining branch distinguishes X vs Douyin return links/metadata labels.

## Web lib/app (U2)
- stream-snapshot schema derivation — CONFIRMED. Move/reuse schemas verbatim; derive curation list type from schema. Client-safe exports. Preserve outer snapshot constraints/defaults: curation original .fields (nullable/defaulted collectedAt+design, nested URL/date/numeric checks, mutable nested arrays; tags nonempty-array/nonempty-element; attachments mutable array of plain strings, empty arrays and empty string elements accepted); ai-news rows nonempty id/title, nullable plain-string publishedAt, Boolean selected, omit reason/score/url; snapshot arrays mutable+nonempty; timestamps finite; scroll positions finite+nonnegative; activeCategory nullable; head check, 400-item cap, TTL, storage keys unchanged.
- rest-destructure both search servers — CONFIRMED. Keep explicit score/normalized-field removals out of SSE sources.
- cachedRequest — CONFIRMED. Preserve cache(() => Effect.runSync(Effect.cached(...))) nesting and laziness; support zero-arg readLiveList (tuple args or leave inline). Never allocate cached Effects outside the React callback.
- contentRowSchema — ADJUSTED. Share curation.ts:12 + open-source.ts:13 (identical nonempty-string). discovery.server.ts:13 stays plain Schema.String + nullable published_at. Adding isMinLength(1) to discovery is a behavior change.
- config defaults — ADJUSTED. reactStrictMode removal CONFIRMED (installed docs). vercel.json framework pin RETAINED (file overrides dashboard; dashboard unverifiable from repo).
- NEW: flatten `...{ question, scope }` spread inside requestSchema (app/api/ask/route.ts:17). NEW: remove block/return around single expression in getOpenSourceListEntries attempt (lib/open-source.ts:20).
- Route revalidate values stay exactly (60 home/news, 300 others). Mobile JSON/SSE field sets unchanged (SiteApi.kt:11, SiteAPI.swift:24, AskClient.swift:38).

## tools/content + packages (U3)
- focus-status health replacement — REJECTED (store clamps future ages, adds lastStartedAt to --json, different diagnostics).
- prepare parseCliOptions — REJECTED (first-vs-last inline source, unknown flags ignored→rejected, diagnostics differ; machine contract via pipeline.mjs:54).
- Shared runner — ADJUSTED (narrowed): share repoRoot resolution (helper under scripts/lib resolves FOUR levels up) + only the three byte-identical labeled catch tails (x-curation-sync:194-198, douyin-curation:269-273, douyin-full-sync:116-120). Keep guards in entry files. local-vectors formatter differs; enrich/ai-news-sync keep top-level-await rejection. Do not move mocked config reads into the runner.
- Supabase factory — ADJUSTED: share construction + {auth:{autoRefreshToken:false,persistSession:false}} only. archive raw env / focus-status own error / sync injected 3-arg clientFactory all stay. Do NOT touch web's cached clients (supabase.server.ts:11).
- shortLinks merge — ADJUSTED: share the strict extractor; keep String(text ?? "") coercion at recover's two callers (recover does NOT already import the media module).
- douyin run() wrapper removal — ADJUSTED: explicit {cwd: repoRoot} at BOTH line-72 dry-run and line-102 normal analysis; runCommand REQUIRES an options object (dereferences options.stdoutPath) — provide one in both branches; sidecar cwd for both uv calls.

## Tests (U4)
- CLI-mock helper — ADJUSTED: share hook registration/resolver/load mechanism only. Per-suite stays: exact-vs-prefix parent matching, query-based module isolation, synthetic URL isolation, enrichment forbidden-adapter fallback, cleanup. Recount net after helper config.
- table-driven use-stream-feed — CONFIRMED: keep all ten response/error scenarios incl. both empty/non-string errors + custom server message; keep separate successful-payload/AbortSignal assertion.
- shared motion mock — ADJUSTED: share repeated DOM/reduced-motion support only; per-suite controls stay (dot-field strips MotionValue styles; loader captures completion; profile supplies controlled thenables; video supplies reduced-motion state); vi.hoisted state per suite.
- e2e ask-identity drop — REJECTED (vitest never exercises drawer close handler/Radix/dynamic import).
- profile storage-failure helper — CONFIRMED: local helper for repeated spies; keep all distinct modes (accessor/read/removal/write/write-plus-removal); no blanket storage-unavailable mock.

## Profile-transition behavioral rewrite (U5)
- Replace append-arity assertions with emitted inline geometry (left/top/width/height vs supplied rects) + transition payload checks. jsdom ghost getBoundingClientRect is all zeros — cannot compare rects. Preserve links textContent, three variants, noninteractive ghosts, cleanup/leak coverage. The rewrite does NOT establish the original batching-performance property. It is independent of isBox — do not sequence as prerequisite.

## Execution-order hazards
1. Runner extraction + CLI mocks change together (douyin test intercepts runCli by entry-script importer; douyin-curation.test.mjs:232-269).
2. Add malformed-payload coverage BEFORE isBox; preserve per-suite motion controls BEFORE deduping mocks.
3. Profile behavioral rewrite is independent of isBox.
4. Shared skeleton ownership stays separate from client callbacks; server shells stay out of client bundle.
5. Shared schemas/cache helpers land before caller migration; schemas client-safe; caching server-only; no ISR changes combined.
6. Rejected moves stay dropped: no health-output standardization, no env-error normalization, no uniform guards/catch behavior, no queue-persister abstraction.
7. Keep stream bodies separate, independent typewriter lifecycles, existing feed options, .d.mts declarations, native API contracts, route ISR values.
