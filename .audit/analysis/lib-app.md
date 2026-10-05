# Simplification audit — apps/web/lib + apps/web/app route files

Scope: `apps/web/lib` (27 TS files + 1 JSON, 2,026 lines) and `apps/web/app` route files (34 TS/TSX, ~1,160 lines). Branch main @ 5aca2c1. Read-only analysis; every claim cites file:line actually read. Mobile contract surfaces (android/ `SiteApi.kt`, ios/ `SiteAPI.swift`, `AskClient.swift`/`.kt`) were read to classify routes as alive.

Headline: this slice is already tight (paginated-route factory, stream-snapshot factory, use-stream-feed, createCurationEntryRoute all exist and are used). There are no dead exports and no dead routes. The honest total is ~60–70 conservative net lines (~2% of the slice) plus two restated-default config lines. The task brief's two big hypotheses — cross-domain type unification and a platform-dispatch registry — do NOT hold at scale here; details below so the campaign doesn't spend effort there.

## Summary — top 10 ranked

| # | Finding | Files | Est. net lines removed | Risk |
|---|---|---|---|---|
| 1 | List-item shape restated twice per domain (server Pick type vs client snapshot schema) — derive one schema, reuse in both | `apps/web/lib/curation-types.ts:127-142`, `apps/web/components/stream-snapshot.ts:89-106`, `apps/web/lib/ai-news.ts:26-30`, `stream-snapshot.ts:67-74` | ~15 | low-med |
| 2 | Field-by-field copy helpers replaceable by rest-destructure | `apps/web/lib/ask-search.server.ts:60-71`, `apps/web/lib/curation-search.server.ts:102-114` | ~15 | low |
| 3 | `cache(() => Effect.runSync(Effect.cached(...)))` triple-wrapper x4 — one shared helper | `apps/web/lib/curation.ts:162-172`, `ai-news.ts:36-47`, `ai-news.ts:71-89`, `open-source.ts:41-51` | ~8 | low |
| 4 | `contentRowSchema` defined 3x identically — export once from `public-database.ts` | `curation.ts:12`, `open-source.ts:13`, `discovery.server.ts:13` | ~4 | low |
| 5 | Hand-rolled try/catch → console.error → `{error}` Response in 3 single-purpose routes | `app/api/ai-news/[id]/route.ts:14-17`, `app/api/cron/ai-news/route.ts:23-26`, `app/api/health/data/route.ts:23-26` | ~6 | low-med |
| 6 | `supabase.server.ts` two-layer client construction — merge to one function | `apps/web/lib/supabase.server.ts:5-21` | ~5 | low |
| 7 | Root layout `robots: {index: true, follow: true}` restates the crawler default (meta tag emitted says "index, follow", identical to no tag) | `app/layout.tsx:28-31` | ~4 | low |
| 8 | Repository routes each wrap `io("route.params", () => context.params)` — move into `repositoryResponse` | `app/api/open-source/[slug]/repository/tree/route.ts:9`, `.../file/route.ts:13` | ~4 | low |
| 9 | `PUBLIC_FEED_CACHE_CONTROL` string duplicated verbatim x3 | `lib/paginated-route.ts:3`, `app/api/ai-news/[id]/route.ts:6`, `app/feed.xml/route.ts:38` | ~2 | low |
| 10 | Restated defaults: `reactStrictMode: true` (App Router default since 13.5.1 per installed docs) and vercel.json `framework: "nextjs"` (auto-detected) | `apps/web/next.config.ts` (reactStrictMode line), `apps/web/vercel.json:3` | 2 | zero |

Optional #11: inline the three one-line client wrappers that all pass a fixed purpose string — `ai-news.ts:22-24 getPublicAiNewsClient`, `ai-news-sync.server.ts:9-11 createAdminClient`, `ask-limiter.server.ts:17-19 getRateLimitClient` (~8 lines). Only worth it if touching those files anyway; the wrappers do keep diagnostics text single-source per module.

## Full findings table

| Category | Files | Evidence (file:line) | Est. lines removed | Risk | Suggested shape | Failure mode to watch |
|---|---|---|---|---|---|---|
| Type/schema duplication | curation-types.ts, stream-snapshot.ts | `curation-types.ts:127-142` (Pick type, 12 field names) vs `stream-snapshot.ts:89-106` (same 12 names via `mapFields(Struct.pick(...))` + attachments) | ~10 | low-med | In curation-types.ts define `export const curationListItemSchema = Schema.Struct({...curationItemSchema.mapFields(Struct.pick([...])).fields, attachments: ...})` and `export type CurationListItem = typeof curationListItemSchema.Type`; stream-snapshot imports it (mechanics already proven at stream-snapshot.ts:90-104) | Snapshot decode must stay byte-identical (mutable, min-length-1 array); covered by tests/stream-snapshot.test.ts and curation-stream e2e |
| Type/schema duplication | ai-news.ts, stream-snapshot.ts, ai-news-types.ts | `ai-news.ts:27-30` and `stream-snapshot.ts:70-74` both build `mapFields(Struct.omit(["reason","score","url"])) + selected` | ~5 | low | Export one `aiNewsListRowSchema` from ai-news-types.ts; import in both | /api/ai-news list rows and snapshot items must decode the same; tests/ai-news.test.ts + stream-snapshot.test.ts pin both |
| Copy-helper boilerplate | ask-search.server.ts | `:60-71` `toAskSource` copies 8 fields off `AskSource & {score}` | ~8 | low | `const { score: _, ...source } = document; return source;` | None — shape unchanged; keep tests/ask-search-ranking.test.ts green |
| Copy-helper boilerplate | curation-search.server.ts | `:102-114` `toAskDocument` copies 8 fields off `DailySearchCorpusEntry` | ~9 | low | `const { lowercaseContent, lowercaseSearchText, lowercaseTitle, ...doc } = entry; return { ...doc, score };` | Score field must remain; tests/ask-search-ranking.test.ts pins scoring |
| Effect boilerplate | curation.ts, ai-news.ts, open-source.ts | 4x `cache((id) => Effect.runSync(Effect.cached(...)))`: `curation.ts:162-172`, `ai-news.ts:36-47`, `ai-news.ts:71-89`, `open-source.ts:41-51` | ~8 | low | One helper in a lib module: `const cachedRequest = <A, E>(program: (id: string) => Effect.Effect<A, E>) => cache((id: string) => Effect.runSync(Effect.cached(program(id))))` | Must keep per-request React cache semantics; never share cached fibers across visitors (apps/web/AGENTS.md Effect rules). readLiveList takes no args — helper needs a 0-arg overload or keep that one inline |
| Row-schema duplication | curation.ts, open-source.ts, discovery.server.ts | identical `Schema.Struct({ content_json: Schema.String.check(Schema.isMinLength(1)) })` at `curation.ts:12`, `open-source.ts:13`; `discovery.server.ts:13` extends it with `published_at` | ~4 | low | Export `contentJsonRowSchema` from `public-database.ts` (already the shared DB entry point); discovery spreads it | None — pure dedupe |
| Route error mapping | api/ai-news/[id], api/cron/ai-news, api/health/data | try/catch + console.error + `Response.json({error}, {status})`: `api/ai-news/[id]/route.ts:14-17`, `api/cron/ai-news/route.ts:23-26`, `api/health/data/route.ts:23-26` | ~6 | low-med | Tiny `failJson(label, error, status=500)` helper (console.error + Response.json). Only 3 call sites — do it only if a lib/http.ts is created anyway for the Cache-Control constant | ai-news detail must keep 404-before-try semantics (`route.ts:12`) and health routes must keep `no-store`; don't route them through a helper that adds default cache headers |
| One-caller wrappers / layers | supabase.server.ts | `:5-9 createSupabaseClient` + `:13-21 getCachedSupabaseClient` — two layers, second always calls first | ~5 | low | Single `supabaseClient(key, purpose)` with the Map cache inline | Client-per-slot cache behavior must not change (auth options at :7) |
| Over-abstraction (mild) | api/open-source/[slug]/repository/* | `tree/route.ts:9` and `file/route.ts:13` both do `io("route.params", () => context.params).pipe(Effect.flatMap(...))` | ~4 | low | `repositoryResponse(noun, signal, params: Promise<{slug}>, read: (slug) => Effect)` awaits params itself | Keep abortSignal propagation (`repositoryResponse` already takes signal at github-repository.server.ts:38-60) |
| Cache-tag/constant strings | paginated-route.ts, api/ai-news/[id]/route.ts, feed.xml/route.ts | same literal `"public, s-maxage=300, stale-while-revalidate=600"` at `paginated-route.ts:3`, `api/ai-news/[id]/route.ts:6`, `feed.xml/route.ts:38` | ~2 | low | Single exported constant (x-media's 86400s video header at `api/x-media/route.ts:89` is intentionally different — leave) | x-nextjs-cache MISS/HIT behavior depends on these exact headers; tests/paginated-route.test.ts:17 pins the feed one |
| Config restating defaults | next.config.ts | `reactStrictMode: true` — installed docs `next/dist/docs/01-app/.../reactStrictMode.md`: "Since Next.js 13.5.1, Strict Mode is true by default with app router" | 1 | zero | Delete the line | None |
| Config restating defaults | apps/web/vercel.json | `"framework": "nextjs"` (vercel.json:3) — auto-detected; `installCommand`/`buildCommand` are NOT defaults (pnpm filtered monorepo install) — keep those | 1 | low | Delete the framework line | If the Vercel project has an explicit framework override in dashboard settings it stays authoritative either way |
| Metadata default | app/layout.tsx | `:28-31 robots: { follow: true, index: true }` emits `<meta name="robots" content="index, follow">` (per installed generate-metadata.md:574) — identical behavior to omitting | ~4 | low | Delete block | Rendered head loses the (redundant) meta tag; robots.ts route rules (`app/robots.ts:5-15`, disallow /api/) are separate and must stay |
| Constant duplication | metadata.ts vs layout.tsx | `metadata.ts:5 RSS_TYPES` vs inline `{ "application/rss+xml": "/feed.xml" }` at `layout.tsx:18` | ~1 | low | Export/reuse RSS_TYPES in layout | Canonical/RSS alternates merge behavior (documented at metadata.ts:17-20) must not change |
| Constant duplication | public-database.ts vs packages/public-data | `apps/web/lib/public-database.ts:7` hardcodes `data/curation.sqlite`; `packages/public-data/src/sqlite.mjs:6` exports the same relative path (consumed by tools at build-curation-sqlite.mjs:12, publish-to-sqlite.mjs:8) | ~1 | low | `path.join(process.cwd(), PUBLIC_DATABASE_PATH)` importing the package constant | Path must still resolve from apps/web cwd in dev and from traced output in prod |
| Platform dispatch residue | curation.ts | identical ternary `platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER` at `:73` and `:144` | ~2 | low | `const ORDER_BY_PLATFORM = { douyin: ..., x: ... }` | Ordering feeds neighbor navigation + feed SQL; douyin-curation-split.test.ts pins both orders |
| Identity regex duplication | api/ask/route.ts, use-ask-conversation.ts | `/^[A-Za-z0-9_-]{16,128}$/` at `api/ask/route.ts:10-11` and `use-ask-conversation.ts:16` | ~2 | low | Export pattern from client-safe `lib/ask-types.ts` (no server-only import) | iOS AskClient.swift documents the same contract in Swift — cannot share; don't change the regex itself |
| Optional: wrapper inlining | ai-news.ts:22-24, ai-news-sync.server.ts:9-11, ask-limiter.server.ts:17-19 | each is a 3-line constant-purpose wrapper over getPublic/AdminSupabaseClient | ~8 | low | Inline at call sites | Error diagnostics wording changes slightly per call site; tests assert behavior not wording |

### Anti-findings — verified NOT deletable (do not burn effort here)

- **No dead exports.** Every export in all 27 lib files has a live consumer. Verified by ripgrep across apps/web (components/app/tests/e2e), packages, tools, android, ios. Even single-consumer items are alive: `cn` (lib/utils.ts:4) → components/ui/button.tsx:25 → ask-chat/ask-message; `isMobileUserAgent` (x-app-link.ts:39) → components/x-app-link.tsx; `getAiNewsUrlHost` → ai-news/[id]/page.tsx:103; `githubRepositoryFileUrl`/`normalizeGitHubPath` → github-repository.server.ts (internal).
- **No dead routes.** All 14 API routes have consumers: android `SiteApi.kt:12-39,51` and ios consume /api/ai-news(+/[id]), /api/curation, /api/design, /api/douyin, /api/open-source, /api/x-media; android `AskClient.kt` + ios `AskClient.swift:84` consume POST /api/ask; /api/cron/ai-news is called by Supabase Cron (AGENTS.md); /api/health/data by GitHub Actions 15-min probe (README.md:82, scripts/check-production-health.mjs:3) and e2e/public-discovery.spec.ts:16; /api/health/ai-news/archive by the prune gate (docs/ai-news-sync.md:57, tools/content/scripts/ai-news-archive.mjs:24); repository tree/file routes by components/open-source-repository-browser.tsx.
- **Per-route `revalidate` is not safely collapsible.** Values are intentionally different: 60 (app/page.tsx:18, ai-news/page.tsx:10) vs 300 (curation/douyin/design/open-source/sitemap + all detail pages). A parent layout at 300 would slow ai-news/home 5x; at 60 it would hammer the curation SQLite reads. Keep.
- **ask-session.server.ts dual storage (Vercel Storage vs local file) must stay.** The `process.env.VERCEL === "1"` branches (ask-session.server.ts:52, 71, 101) cover prod vs local dev/tests (tests/ask-session-effect.test.ts:35 stubs VERCEL=1; local dev uses var/ask-sessions, gitignored at .gitignore:26). The `withSessionLock` semaphore map (:128-143) is mandated by docs/effect-architecture.md ("等待锁的任务被取消时…释放等待计数"). No @site/effect combinator covers it (packages/effect/src/index.mjs is only io/attempt/OperationError). Real duplication in this file: none worth >5 lines.
- **`dynamic = "force-dynamic"` on api/health/ai-news/archive/route.ts:4** looks removable but is protective (route reads sqlite open side effect; without it Next may attempt build-time prerender). Leave.
- **design/[id] has no loading.tsx on purpose** (design/[id]/page.tsx:13-16 comment; e2e/curation-isr.spec.ts guards the soft-404 contract). Don't "normalize" it.
- **next.config.ts is nearly all load-bearing**: outputFileTracingRoot/turbopack.root (monorepo), tracing excludes (sensitive-data guard required by AGENTS), sqlite includes, staleTimes (documented perf fix), security headers (not Next defaults), `poweredByHeader: false` (docs confirm x-powered-by is added by default). Only reactStrictMode is a restated default.
- **`getOpenSourcePage` (open-source.ts:31-39)** looks like a pointless slice over getOpenSourceListEntries but exists for /api/open-source `{hasMore, items}` contract parity consumed by both mobile clients — keep.

## Type-unification analysis

How much do curation-types (142), ai-news (22-line schema in packages/public-data/src/ai-news/content.ts), open-source-schema (40), and AskSource (ask-types.ts:6-15) actually share?

Field matrix (read from the four schemas):

| Field | curation | ai-news | open-source | AskSource |
|---|---|---|---|---|
| id | `id` | `id` | `slug` (different name) | `id` + `sourceId` |
| title | `title` | `title` | `repository` (different name/semantics) | `title` |
| url | `source.url` (nested) | `url` | `repositoryUrl` + `evidence.url` | `sourceUrl` |
| published timestamp | `publishedAt` (UTC schema) | `publishedAt` (plain string) | not in schema (column `published_at`, display uses `evidence.checkedAt`) | `publishedAt` (nullable) |
| summary | `summary` | `summary` | `sourceSummary` | `content` (different semantics: full text) |

True intersection is `id + title + publishedAt` with inconsistent names elsewhere. A shared `EntryBase` schema would save ~3 lines x 3 domains minus 3 lines of base + `Schema.extend` plumbing ≈ **~5 net lines**, at the cost of coupling three projections that evolve independently and are contractual toward android/ios decoders. **Not recommended.** The unified-search shape already exists where it pays off (`AskSource` + the `source_scope` table in ask_documents, packages/public-data/src/sqlite.mjs:45-55).

Where type duplication is real and worth taking: the per-domain *list projection* stated twice (server TS `Pick`/`Omit` type + client snapshot Effect Schema) — findings rows 1-2 above, ~15 lines. That keeps each domain's full schema untouched.

## Platform-dispatch analysis

Every platform branch found in the slice:

- `curation.ts:72` — designOnly special-cases platform `x` in the WHERE clause
- `curation.ts:73` and `curation.ts:144` — identical douyin/x order ternary (the only literal duplication)
- `curation-entry.tsx:19-32` — SECTION_BY_CONTEXT **already a registry table** keyed by context, with a nested platform check for back-links
- `curation-entry.tsx:119,191` — `item.source.platform === "x"` handle-vs-name presentation choices
- `ai-news-types.ts:121-127` — host-based wording for the original-source button (x/weixin/github)
- `x-app-link.ts:1-11` — X host sets
- `github-repository.server.ts` — no platform dispatch at all (single-platform by construction)

Verdict: dispatch is already mostly table-ized or is genuine per-platform presentation, not repeated logic. The proposed platform registry nets ~2 lines (ORDER_BY_PLATFORM object killing two ternaries). There is no 30-80-line branch forest to harvest here. The registry is a nice-to-have consistency fix, not a simplification win.

## API-contract watchlist (mobile clients — preserve exactly)

| Route | Consumers | Contract pins |
|---|---|---|
| GET /api/ai-news (limit/offset → `{hasMore, items}`) | android SiteApi.kt:12; ios SiteAPI | pageStep 50 / maxLimit 100 (api/ai-news/route.ts:6-12); Models.kt:5-9 decode `{hasMore, items}` |
| GET /api/ai-news/[id] (`{item}`) | android :18; ios | 404 semantics at route.ts:12; CDN header route.ts:6 |
| GET /api/curation (extra `tag` param) | android :21; ios | route.ts:9-18 wraps the factory with tag validation |
| GET /api/design | android :27; ios | api/design/route.ts:4-9 |
| GET /api/douyin | android :33; ios | api/douyin/route.ts:5-10 |
| GET /api/open-source | android :39; ios (OpenSourceListEntry fields in Models.kt / Models.swift) | api/open-source/route.ts:6-11 |
| GET /api/x-media (video proxy) | android :51; ios MediaURLs | host/path allowlist api/x-media/route.ts:3-4, 28-38 |
| POST /api/ask (SSE: text/sources/done/error) | android AskClient.kt; ios AskClient.swift:84 ("lib/ask-types.ts 契约") | event shapes in app/api/ask/route.ts:31-33, 55-95 + components/ask-sse.ts:27-51; session id regex route.ts:10-11 |

Ops contracts (not mobile but external): /api/cron/ai-news (Supabase Cron, Bearer auth route.ts:12-17), /api/health/data (GitHub Actions), /api/health/ai-news/archive (prune gate checks `digest` equality), /feed.xml + /sitemap.xml + /robots.txt.

Any finding above that touches these routes (rows 5, 8, 9, 17) must keep status codes, headers, and event names byte-identical.
