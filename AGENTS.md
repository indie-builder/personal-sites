<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions

- Prefer the simplest implementation that meets the current need; reuse existing code before adding abstractions or dependencies.
- This personal project does not require backward compatibility unless requested, including for published APIs and installed clients. Replace old APIs and structures directly and update current callers; preserve data integrity without compatibility layers or dual-version support.
- Web is the primary product, including desktop and mobile browsers. Native 「陈远小站」 clients in `android/` and `ios/` consume public content GET APIs and `POST /api/ask`; follow each client's README for platform requirements, build commands, and tests.

## Workspace

- `apps/web` owns Next.js, UI and HTTP APIs; `tools/content` owns offline pipelines; `packages/public-data` owns shared public schemas, SQLite helpers and news synchronization.
- Next.js guides resolve from `apps/web/node_modules/next/dist/docs/`. Keep shared packages independent of apps and offline tool dependencies.
- Canonical SQLite snapshots stay in root `data/`. Web build/dev copies only the three approved files (`curation.sqlite`, `ai-news.sqlite`, `portfolio.sqlite`) into ignored `apps/web/data/`. Do not copy sensitive directories.
- Data operations bypass Turbo caching; Web build caching stays disabled while prerendering reads Supabase. See `docs/monorepo.md`.

## Task and Domain Context

- For issues or specifications, follow `docs/agents/issue-tracker.md` for this repository's GitHub Issues.
- For issue triage, use the role mapping in `docs/agents/triage-labels.md`.
- For domain concepts or design decisions, follow `docs/agents/domain.md` to read the root glossary and relevant ADRs.

## Effect

- Effect is the default for TypeScript/JavaScript business I/O and asynchronous orchestration across Web, shared packages, and content pipelines; follow `docs/effect-architecture.md`. Pure transformations and React/platform lifecycles stay native.
- Return Effects from business functions; execute them only at Next.js, React callbacks/cache allocation, CLI, or test boundaries. Use Effect Schema, bounded concurrency, scopes, and explicit retry policies; keep SDK/Node Promise adapters small.
- Use the pinned stable Effect version and `@site/effect` I/O adapters. Do not add parallel Promise business APIs, manual worker pools, timeout races, or Promise lock chains.

## Package Manager and Checks

- Use `pnpm` with Node.js `>=24.21.0 <25` (major capped at Vercel's max supported 24.x); the package manager is pinned in `package.json`.
- Default dev startup is domain-based via portless: `pnpm dev:domain` dispatches to `apps/web` and serves `https://personal-site.localhost` (fixed app port 3000). Plain `pnpm dev` stays available for raw-port use.
- For app code or configuration changes, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. For documentation-only changes, verify referenced commands/paths and run `git diff --check`; no app build is required.
- `pnpm test` runs package tests through Turborepo (Vitest and Node); browser E2E is separate: `pnpm test:e2e` drives the e2e runner over `apps/web/e2e/*.e2e.ts`, and `pnpm test:e2e:touch` drives Playwright over the `*.spec.ts` holdouts (touch-device and `prefers-reduced-motion` CSS cases). Run relevant browser regressions for changed UI flows in addition to live verification below.
- Keep the intentional TS7 setup in `scripts/tsc7.mjs` and the peer exceptions in `pnpm-workspace.yaml`; lint uses oxlint/oxc-parser. Do not downgrade TypeScript to satisfy the unused typescript-eslint fallback's peer cap.
- Reuse the running Web dev server: Next allows one dev instance per app directory. Browser E2E owns port 7100 and builds by default (`pnpm test:e2e` builds, then the runner starts the production server); after a successful build of unchanged sources, `PLAYWRIGHT_REUSE_BUILD=1 pnpm test:e2e:touch` reuses it for the Playwright holdouts.

## File-Scoped Commands

| Task | Command |
| --- | --- |
| Lint one file | `pnpm exec oxlint apps/web/path/to/file.tsx` |
| Run one Vitest file | `pnpm --filter @site/web exec vitest run tests/file.test.ts` |

## Frontend

- Treat `PRODUCT.md` (strategic context), `DESIGN.md` and `docs/frontend-architecture.md` as the current UI source of truth; `docs/redesign-plan.md` is historical.
- Preserve the desktop-first identity rail plus continuous content-flow layout. Do not restore the legacy knowledge/workspace shell or introduce card grids, glass, heavy shadows, or broad accent colors.
- Reuse the identity rail on detail pages. New motion needs cleanup, a stable final state, and a `prefers-reduced-motion` path.
- Mobile browsers are a supported product surface: verify narrow screens (320/390px), landscape layouts, touch targets, detail reading, and the Ask composer alongside desktop.
- For UI changes, use ego lite to verify the running Next app: compiler issues, routes, console/network errors, and rendered interactions. Keep automated browser regressions in `apps/web/e2e/`; live inspection and regression tests serve different purposes.

## Data, Privacy, and Caching

- Read `docs/sensitive-data.md` before touching curation inputs or credentials. Never stage, publish, render, screenshot, or expose `data/sensitive/`, `knowledge/sensitive/`, local credentials, or `tools/smaug/.state/`.
- Public content comes from approved projections: X/Douyin/GitHub content and the local Ask index use the bundled, runtime-read-only `data/curation.sqlite`; AI news merges bundled `data/ai-news.sqlite` history with Supabase `ai_news_public_items` updates. Never fall back to sensitive local data. Service-role keys never belong in `NEXT_PUBLIC_*` variables.
- Keep public curation detail reads cacheable with ISR (`revalidate = 300`) and loading states. SQLite content changes require rebuilding the public projection and redeploying; ISR does not refresh the bundled data. For cache changes, verify production route classification and `x-nextjs-cache` MISS then HIT behavior.
- Treat `curation:*`, `douyin:*`, `github:starred:*`, `ai-news:sync`, `ai-news:backfill`, `ai-news:archive`, `ai-news:prune`, and `supabase:push` as data operations, not validation commands. Follow `docs/supabase-x-sync.md`, `docs/douyin-curation.md`, `docs/github-starred-sync.md`, and `docs/ai-news-sync.md`; run `pnpm supabase:push -- --dry-run` before a database write.
- Run daily Star syncs one at a time and report partial results until the process exits. For AI news, Supabase Cron calls `/api/cron/ai-news` every 5 minutes; GitHub Actions handles daily backfill/manual recovery. Verify actual run results before reporting success.

## Git and Commits

- Inspect `git status` before editing or staging. Stage only agreed paths; `tools/smaug` is a nested repository and must stay out of outer-repo commits.
- Run `pnpm git:safety` before commits that could touch content or configuration. Do not bypass the pre-push guard or rewrite history without explicit approval.
- For routine changes, create a topic branch, review the diff, commit, push, and open a PR. A PR is not permission to merge: merging, force-pushing, and pushing directly to the default branch require the user's explicit request.
- Use Chinese Conventional Commit subjects for project changes.

## Commit Attribution

- AI commits include the agent's actual model attribution; replace the placeholder:

  ```text
  Co-Authored-By: <agent model> <noreply@example.com>
  ```

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
