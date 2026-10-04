---
name: verify-personal-sites
description: Verifies changes to the personal-sites Web app and public content using the current repository checks and real browser interactions. Use after Web code, configuration, or public projection changes, and before reporting those changes as verified.
---

# Verify personal-sites

1. Read root `AGENTS.md` and the changed workspace's instructions. Determine the changed paths and separate pre-existing work; verify only against the current revision, not a previous run's results.
2. For Web behavior or rendering, read `docs/frontend-architecture.md` and the relevant section of `DESIGN.md`. For public content, read `docs/sensitive-data.md`; use only approved public projections. For native changes, follow that client's README.
3. Run the checks required by `AGENTS.md`. App code/configuration requires `pnpm typecheck`, `pnpm lint`, `pnpm test`, and a production build. Documentation-only changes require referenced paths/commands and `git diff --check`, not an app build. Report each result separately.
4. For changed Web interactions, run relevant specs from `apps/web/e2e/`. Read `apps/web/playwright.config.ts` first: the default E2E command builds and starts its own production server. Count that build as the required production build; if the same unchanged revision was already built, use `PLAYWRIGHT_REUSE_BUILD=1 pnpm test:e2e` to avoid rebuilding. Reuse an existing dev server for live inspection; E2E owns port 7100.
5. Inspect the running app with ego lite: the changed flow, one adjacent interaction, compiler issues, console/network failures, and rendered state. Cover desktop plus 320/390px and landscape where the changed UI is responsive; check keyboard, theme and reduced motion when relevant. For Ask, verify partial output, stop/retry, scrolling and completed citations with synthetic public fixtures before any separately authorized live model call.
6. For changes to public data/cache behavior, verify the affected public read paths and cache semantics from the project instructions. Data sync, backfill, publication and database writes are operations, not validation commands.
7. Before committing content/configuration, run `pnpm git:safety` and review the staged paths. Keep logs/screenshots in ignored local output; never capture private inputs, credentials or stored conversations.

Done means the applicable checks have completed, their actual exit/results are known, and any live-inspection defects are resolved or explicitly reported. State failed, skipped and unavailable checks rather than substituting confidence for evidence. Summarize what changed, commands and browser evidence, and remaining limits; do not claim a deployment or merge that has not been confirmed.
