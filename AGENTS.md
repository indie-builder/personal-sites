<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions

- Prefer the simplest implementation that meets the current need; reuse existing code before adding abstractions or dependencies.
- This personal project does not require backward compatibility unless requested, including for published APIs and installed clients. Replace old APIs and structures directly and update current callers; preserve data integrity without compatibility layers or dual-version support.
- Web is the primary product, including desktop and mobile browsers. Native 「陈远小站」 clients in `android/` and `ios/` consume public content GET APIs and `POST /api/ask`; follow each client's README for platform requirements, build commands, and tests.

## Package Manager and Checks

- Use `pnpm` with Node.js `>=22.19.0`; the package manager is pinned in `package.json`.
- Default dev startup is domain-based via portless: `pnpm dev:domain` serves `https://personal-site.localhost` (fixed app port 3000). Plain `pnpm dev` stays available for raw-port use.
- For app code or configuration changes, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. For documentation-only changes, verify referenced commands/paths and run `git diff --check`; no app build is required.
- `pnpm test` runs Vitest and Node tests; Playwright is separate (`pnpm test:e2e`). Run relevant browser regressions for changed UI flows in addition to live verification below.
- Keep the intentional TS7 setup in `scripts/tsc7.mjs` and the peer exceptions in `pnpm-workspace.yaml`; lint uses oxlint/oxc-parser. Do not downgrade TypeScript to satisfy the unused typescript-eslint fallback's peer cap.
- For a second dev server, use `pnpm exec next dev --turbopack --hostname 127.0.0.1 --port 7100`; do not use `pnpm dev -- --port 7100`.

## File-Scoped Commands

| Task | Command |
| --- | --- |
| Lint one file | `pnpm exec oxlint path/to/file.tsx` |
| Run one Vitest file | `pnpm exec vitest run path/to/file.test.ts` |

## Frontend

- Treat `PRODUCT.md` (strategic context), `DESIGN.md` and `docs/frontend-architecture.md` as the current UI source of truth; `docs/redesign-plan.md` is historical.
- Preserve the desktop-first identity rail plus continuous content-flow layout. Do not restore the legacy knowledge/workspace shell or introduce card grids, glass, heavy shadows, or broad accent colors.
- Reuse the identity rail on detail pages. New motion needs cleanup, a stable final state, and a `prefers-reduced-motion` path.
- Mobile browsers are a supported product surface: verify narrow screens (320/390px), landscape layouts, touch targets, detail reading, and the Ask composer alongside desktop.
- Verify UI changes in the running Next app with ego lite: inspect compiler issues, routes, browser errors, and the rendered interaction in a real page.
- Use ego lite for all agent-driven browser work — opening URLs, verifying UI, clicking through flows. Run everything through `ego-browser nodejs <<'EOF' ... EOF` heredocs; follow the ego-browser skill for task spaces, snapshots, and helpers.
- Debug through ego lite CDP: `cdp(...)` for protocol-level needs (console messages, network, dialogs), `js(...)` for in-page state and DOM inspection. Collect browser errors this way instead of guessing from screenshots.
- Keep Playwright specs in `e2e/` for automated regression; ego lite is for agent-driven inspection and does not replace them.

## Data, Privacy, and Caching

- Read `docs/sensitive-data.md` before touching curation inputs or credentials. Never stage, publish, render, screenshot, or expose `data/sensitive/`, `knowledge/sensitive/`, local credentials, or `tools/smaug/.state/`.
- Public content comes from approved projections: X/Douyin/GitHub content and the local Ask index use the bundled, runtime-read-only `data/curation.sqlite`; AI news uses Supabase `ai_news_public_items`. Never fall back to sensitive local data. Service-role keys never belong in `NEXT_PUBLIC_*` variables.
- Keep public curation detail reads cacheable with ISR (`revalidate = 300`) and loading states. SQLite content changes require rebuilding the public projection and redeploying; ISR does not refresh the bundled data. For cache changes, verify production route classification and `x-nextjs-cache` MISS then HIT behavior.
- Treat `curation:*`, `douyin:*`, `github:starred:*`, `ai-news:sync`, `ai-news:backfill`, and `supabase:push` as data operations, not validation commands. Follow `docs/supabase-x-sync.md`, `docs/douyin-curation.md`, `docs/github-starred-sync.md`, and `docs/ai-news-sync.md`; run `pnpm supabase:push -- --dry-run` before a database write.
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
