<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Effect

- Follow root `AGENTS.md` and `../../docs/effect-architecture.md`; Web business functions return Effects and public schemas use Effect Schema.
- Next route handlers/server components and React event handlers execute Effects at their boundary; keep Next routing, ISR, React state, CSS/Motion and HTTP/SSE contracts in their native APIs.
- Propagate request AbortSignals to Effect execution and SDK adapters. Cached request Effects use React `cache` plus `Effect.cached`; never share request-bound fibers across visitors.
