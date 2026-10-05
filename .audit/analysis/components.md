# Components simplification audit — apps/web/components

Slice: `apps/web/components` (46 files; ~5,087 lines TS/TSX + 3 CSS modules).
Method: every file in the slice read in full; DESIGN.md Components/Motion sections read first; every "dead" claim verified with ripgrep across `apps/web`, `packages`, `tools`, `android`, `ios`, `.agents`, `docs`, and `apps/web/tests` + `apps/web/e2e` (test-pinned APIs are not dead). Root-level stale `app/`, `components/`, etc. were never read.

**Headline: ~85 net lines conservatively removable inside components (~95 counting two adjacent app loading files), out of 5,087 (~1.8%).** This slice is already tight. The big win is not deletion but de-triplication of the stream filter menu and status footer; the ask and profile-transition families are identity-pinned by DESIGN.md and should not be structurally merged.

Guardrails observed (do not delete): identity rail + sticky 100dvh profile (DESIGN.md 身份轨), continuous-row streams with shared density (每日关注/设计收藏/抖音收藏共用), pixel assistant Ovid behavior (像素助手 section is a registered visual exception), typewriter sequence with no skip (已裁决), opening-loader 5s fixed ritual (已裁决), printer skeuomorph exception, dot-field danmaku + reduced-motion 3x4 grid.

---

## Summary — top opportunities ranked by (lines saved / risk)

1. **F1 — Shared `StreamFilterMenu` for the three Radix filter menus** (−15, risk low-med). Saves the most duplication in the slice; e2e pins labels/classes, so verify against `curation-tags.spec.ts`, `ai-news-filter.spec.ts`, `open-source-filter.spec.ts`.
2. **F4 — Collapse the 18-line `Number.isFinite` wall in `readProfileTransition`** (−11, risk low). Pure predicate refactor; `profile-transition-state.test.ts:57` pins rejection of invalid payloads.
3. **F14 — `profile-introduction.tsx` internal duplicates** (`resetTitleToChinese` ≡ `showChinese`; `typeTitle` ≈ `typeGreeting`) (−12, risk low).
4. **F2 — Shared `StreamStatus` footer (skeleton/error/retry/done) + skeleton dedup** (−12, risk low). DOM must stay byte-identical; `stream-load-more-resilience.spec.ts` pins `.curation-home__stream-status`, the 重试 button, and copy.
5. **F6 — Local `fetchRepositoryJson` helper in `open-source-repository-browser.tsx`** (−10, risk low). Two hand-rolled fetch/JSON/error extractions collapse into one.
7. **F5 — Delete `StreamSnapshotAdapter` interface; type comes from `stream-snapshot.ts`** (−6, risk low). Removes cross-file drift between the factory and its consumer's mirror type.
8. **F11 — Extract shared clip/tags JSX in `curation-stream.tsx` design-vs-default variants** (−7, risk low).
9. **F3 — Shared entrance-stagger motion props + move `FILTER_REVEAL_COUNT` to `motion-tokens`** (−5 direct, plus consistency). Honest note: line savings are small; the value is one definition of the "0.45rem + 32ms" language.
10. **F7 — Shared `useSiteThemeDark()` for theme-toggle + ask-answer** (−3, risk low).

(F9/F10 below cross into `apps/web/app`; +10 more if taken.)

---

## Full findings table

| # | Category | Files | Evidence | Est. lines removed | Risk | Suggested shape |
|---|---|---|---|---|---|---|
| F1 | Duplication | curation-stream.tsx, ai-news-stream.tsx, open-source-stream.tsx | curation-stream.tsx:60-77; ai-news-stream.tsx:23-30,124-140; open-source-stream.tsx:49-74 — same DropdownMenu Root→Trigger(`ai-news__category-select`+ChevronDown)→Portal→Content(align end, sideOffset 4, collisionPadding 16)→RadioGroup→RadioItem+CheckIndicator stack, 3x | 15 (69 dup lines − ~30 comp − ~21 call sites) | low-med | New `components/stream-filter-menu.tsx` with props `{ariaLabel, value, options: {value,label}[], onSelect, menuClassName?}`; keep per-stream aria-labels and extra menu classes |
| F2 | Duplication | curation-stream.tsx, ai-news-stream.tsx, page-shell.tsx | curation-stream.tsx:221-239; ai-news-stream.tsx:209-230; page-shell.tsx:13-22; skeleton 3-span block repeated also in app/ai-news/loading.tsx:10-14 | 12 | low | `<StreamStatus>` component (tag/className as props — ai-news uses `div.ai-news__status`, curation `li.curation-home__stream-status`) + reuse in FeedSkeleton; DOM byte-identical |
| F3 | Bloat/motion | curation-stream.tsx, ai-news-stream.tsx, open-source-stream.tsx, motion-tokens.ts | curation-stream.tsx:151-160; ai-news-stream.tsx:166-175; open-source-stream.tsx:81-89; FILTER_REVEAL_COUNT declared twice (ai-news-stream.tsx:21, open-source-stream.tsx:24) | 5 | low | Helper returning `{initial, animate, transition}` for appended/reveal rows; constants (`0.45rem`, 0.032, FILTER_REVEAL_COUNT) move to motion-tokens.ts |
| F4 | Bloat/dead-weight | profile-transition-state.ts | lines 146-163: 12 chained `Number.isFinite(value.<box>.<field>)` guards | 11 | low | 5-line `isBox(v): v is ProfileTransitionBox` + 3 calls; predicate must stay equivalent (test pins null on invalid) |
| F5 | Over-abstraction (mirror type) | use-stream-feed.ts, stream-snapshot.ts | use-stream-feed.ts:22-30 restates the factory's return shape in prose-comment + interface | 6 | low | Export the instance type from stream-snapshot.ts (or `ReturnType<typeof createStreamSnapshot<...>>` via declaration); import in use-stream-feed |
| F6 | Duplication | open-source-repository-browser.tsx | tree fetch 149-166 vs file fetch 185-195: same fetch→json→`result.error ?? fallback`→throw pattern | 10 | low | Local `fetchRepositoryJson<T>(url, fallbackError)` (keep throw semantics; do NOT merge with requestStreamPage which returns strings) |
| F7 | Duplication | theme-toggle.tsx, ask-answer.tsx | theme-toggle.tsx:7-18 and ask-answer.tsx:18-22+29: two `MutationObserver` on `data-curation-theme` + snapshot fns | 3 | low | Shared `useSiteThemeDark()` hook (small module or in use-mounted.ts) |
| F8 | Dead code | opening-loader.tsx | line 22: `const hasPlayedThisSession = hasOpeningPlayedThisSession;` pure alias, used once at :27 | 1 | low | Delete alias, call imported name |
| F9 | Duplication (cross-boundary, optional) | app/page.tsx, page-shell.tsx | app/page.tsx:26-48 hand-rolls FeedPage's shell (page-shell.tsx:25-38) plus FeedErrorBoundary/FeedRecoveryTarget | 6 | med | FeedPage gains optional `errorBoundaryLabel` that wraps Suspense in FeedErrorBoundary+FeedRecoveryTarget; keeps `data-feed-recovery-root` — only if the prop stays simple |
| F10 | Duplication (app file, optional) | app/ai-news/loading.tsx | lines 5-16 duplicate FeedSkeleton's markup | 4 | low | Import FeedSkeleton (no label) |
| F11 | Duplication | curation-stream.tsx | design branch 189-194 ≡ default branch 207-214 (blockquote clip + tags row) | 7 | low | Local `<StreamClipAndTags item>` fragment used by both variants |
| F12 | Dead default | curation-stream.tsx | line 94 `apiPath = "/api/curation"` — all callers pass apiPath (design :21, douyin :23, Tagged :81) | 1 | low | Make prop required, drop default |
| F13 | Dead branch | growing-paragraph.tsx | line 10 early-returns when `reduceMotion`; line 22 `if (!reduceMotion)` re-check is therefore always true (reduceMotion can't change without effect re-run) | 1 | low | Delete inner conditional, keep the animate call |
| F14 | Duplication (in-file) | profile-introduction.tsx | `resetTitleToChinese` 74-78 is byte-identical to `showChinese` 82-86; `typeTitle` 169-174 ≈ `typeGreeting` 98-103 | 12 | low | One `showChinese` + one `typeTitleText(text, delay, done?)`; keep greeting-cycle timing identical |
| F15 | Runtime waste (0 lines) | open-source-stream.tsx, use-stream-date.ts | open-source-stream.tsx:30 discards `useStreamDate`'s return; the hook's day-tracking effect (use-stream-date.ts:30-62) then installs scroll/resize/rAF listeners scanning zero `[data-stream-date]` nodes | 0 (efficiency) | low | Split hook into `useStickyToolbarOffset` + `useStreamDate`; open-source imports only the former |
| F16 | Platform dispatch — already table-driven | curation-entry.tsx, curation-stream.tsx | SECTION_BY_CONTEXT (curation-entry.tsx:19-32) and `item.source.platform === "x" ? ... : ...` ternaries (curation-stream.tsx:201, curation-entry.tsx:119,191) | 0 | — | Already minimal; two x/douyin ternaries at 3 sites could become one `formatCurationByline(item)` in lib but saves <4 lines — optional |

No dead exports were found. Verified live (not dead): `requestStreamPage` (tests/use-stream-feed.test.ts:4), `FeedErrorState`/`FeedRecoveryFocus` (tests/focus-stream-error-boundary.test.tsx:5-6 — exported for tests, used internally), `AiNewsRelativeTime` (app/ai-news/[id]/page.tsx:8), `subscribeToNothing` (opening-loader.tsx:4, open-source-document-view.tsx:4), `useMediaQuery` (ask-chat, profile-introduction), `MotionMessageScrollerItem`/`AskMessageItem` (ask-chat.tsx:6), `AssistantSprite` + `SpriteWalker` (ask-assistant.tsx:7, ask-chat.tsx:5), `TaggedCurationStream` (app/curation/page.tsx:4), snapshot `from/to` `now?` params (tests/stream-snapshot.test.ts:14-15). Android/iOS clients consume HTTP APIs only — no component exports reach them.

---

## Family analyses

### Stream family (curation-stream 243, ai-news-stream 233, open-source-stream 112, use-stream-feed 224, stream-snapshot 118, focus-stream-error-boundary 145, curation-scroll 48, use-stream-date 65 = 1,088 lines)

Current duplication:
- Filter menu JSX triplicated (F1); status footer duplicated (F2); entrance-stagger props triplicated with two `FILTER_REVEAL_COUNT` declarations (F3); skeleton markup in 4 places (F2/F10).
- `use-stream-feed` is consumed by exactly two components (AiNewsStream, CurationStream x3 call sites). OpenSourceStream does not paginate — it filters a fully-server-rendered list — so it shares none of the feed machinery beyond the motion vocabulary.

Proposed unified shape: **not a universal stream component — a small shared-parts kit.** `StreamFilterMenu` + `StreamStatus` + entrance-motion helper + `motion-tokens` constants. The three stream bodies stay separate on purpose: DESIGN.md assigns each a distinct identity (判断流 registry-row density, ai-news grouped timeline with filter-reveal remount, open-source repo-judgment rows), and their pagination/snapshot shapes differ (ai-news snapshot restores `activeCategory`; curation variants use per-section storage keys; open-source has no pagination). A config-table-driven mega-stream would add indirection and fight those pinned identities.

Net estimate: F1+F2+F3+F5+F12 in this family ≈ **−39 lines**, plus one definition of every shared contract. Risk concentration: the three filter e2e specs and the resilience spec are the verification nets; any unified component must reproduce aria-labels, `curation-category-menu`/module-class extras, and status classes exactly.

### Profile-transition family (profile-transition-state 185, profile-transition-bridge 154, section-motion-lifecycle 113, plus consumers mobile-profile-collapse 56, section-navigation-link 110)

No structural merge recommended. The three files are genuinely different phases of one pinned mechanism (DESIGN.md: 手机身份展开/收拢「沿用既有可清理桥接」; feed-hold, drift→flight handoff math, reveal ladder): state = ghost creation/drift/sessionStorage; bridge = landing flight + reveal; lifecycle = first-visit stagger armed on opening-reveal. Only cleanup: F4 (−11). `stopProfileGhostDrift` export is used by both state-internal cleanup and the bridge — keep.

### Ask family (ask-chat 266, ask-assistant 191, use-ask-conversation 161, assistant-sprite 178, ask-message 103, ask-answer 59, ask-sse 51, ask-chat-snapshot 79 = 1,088 lines)

The family looks large but is almost entirely identity-pinned (DESIGN.md 像素助手 section: Ovid sprite behavior, sink/rise, drawer narrowing, welcome layout, 44px targets). Shared code is already factored (`SpriteWalker` shared between launcher and welcome; `use-ask-conversation` owns SSE+snapshot; `ask-sse` owns parse/apply). Only real finding: F7 theme-store duplication with theme-toggle (−3). The `AskChat` welcome vs follow-up suggestion buttons differ deliberately (3-icon welcome row vs single continuation chip) — not worth unifying. The textarea auto-resize effect (ask-chat.tsx:48-73, 26 lines) could theoretically shrink via CSS `field-sizing: content`, but cross-browser support (Safari) is not safe to assume for the primary mobile surface — see Not-recommended.

### Open-source family (open-source-repository-browser 274, open-source-stream 112, document-view 114, document-tabs 102 = 602 lines)

- F6 fetch helper (−10) inside the browser component.
- F15: `useStreamDate` split — open-source only needs the sticky-toolbar offset half; today it pays for day-tracking listeners that can never find a date node (its toolbar shows a project count, by DESIGN).
- document-tabs (server, markdown wiring) vs document-view (client tabs) is a clean two-role split with one consumer each; merging saves ~0 and couples server markdown wiring to a client component. Keep.
- The hand-rolled roving-tabindex in document-view (moveTab, 41-52) could become Radix Tabs, but that is a library swap for ~−12 lines with e2e-pinned focus behavior — not worth it (see Not-recommended).
- What makes repository-browser big: recursive tree rows with AnimatePresence per directory, plus dual fetch state machines. The recursion and animation are inherent; after F6 it lands near 260 lines with no speculative props found (all props passed by app/open-source/[slug]/page.tsx:58).

---

## Not-recommended (looks deletable, isn't)

1. **Do not merge the three stream components into one configurable component.** DESIGN.md pins per-section identities (判断流 vs 动态分组 vs 仓库判读) and the e2e suite (curation-tags, ai-news-filter, open-source-filter, open-source-motion, home-streaming) pins per-stream DOM. Savings would be negative after the config table.
2. **Do not delete or "simplify" opening-loader's fixed 5s battery ritual or the typewriter's no-skip policy** (opening-loader.tsx:44-49; profile-introduction.tsx playSequence). DESIGN.md explicitly records both as 已裁决设计决定; the `MutationObserver` waiting for `.opening-loader` removal (profile-introduction.tsx:237-247) is the sync seam, not dead code.
3. **Do not replace ask-chat's manual textarea auto-resize with `field-sizing: content`** — Safari support is not guaranteed for the mobile-primary surface; the 26-line effect also carries rAF dedupe and the 22/112px clamps from DESIGN.md (初始高度 84px/16px 圆角 specs).
4. **Do not swap open-source-document-view's manual roving-tabindex for Radix Tabs.** Current code is 12 lines of key handling; a swap risks focus/e2e regressions (open-source specs) for marginal deletion.
5. **Do not inline `page-shell.tsx` helpers into callers** — FeedPage/DetailPage/DetailTopbar/LoadingDocument/DetailLoadingChrome each have 2-7 consumers across app pages (verified above); this is the opposite of a one-caller wrapper.
6. **Do not remove the "speculative-looking" props on use-stream-feed** (`snapshotExtra`, `onSnapshotRestore`, `storageKey`, `snapshotHeadId`): ai-news uses extras+restore, curation-tag/design/douyin use keys+headId — every knob has a live consumer. Same for `XVideoPlayer.compact` (design variant, curation-stream.tsx:178) and `XAppLink.target` default (harmless prop forwarding).
7. **Do not delete `FeedErrorState`/`FeedRecoveryFocus` exports** although app code only uses `FeedErrorBoundary`/`FeedRecoveryTarget` — tests/focus-stream-error-boundary.test.tsx imports them directly; they are the test seam for the retry/focus contract.
8. **Do not "fix" the ai-news filteredIndex vs itemIndex dual maps** (ai-news-stream.tsx:75,91-101). The comment at 89-90 documents why both exist (filter-reveal window must use the flattened filtered order); collapsing them silently disables the reveal animation.
9. **CSS modules (`ask-chat.module.css`, `ask-assistant.module.css`, `open-source.module.css`, `site-section-navigation.module.css`)** were not audited class-by-class for dead selectors — that is a separate sweep with its own verification cost; flagged as follow-up only.

## Verification checklist for any taker

- `pnpm typecheck && pnpm lint && pnpm test` (vitest covers stream-snapshot, use-stream-feed, focus-stream-error-boundary, profile-transition-state, curation-tags).
- `pnpm test:e2e` — specifically curation-tags, ai-news-filter, open-source-filter, stream-load-more-resilience, home-streaming, profile-motion, section-navigation.
- Mobile: filter menus stay reachable (44px items, viewport-anchored), status footer copy unchanged.
