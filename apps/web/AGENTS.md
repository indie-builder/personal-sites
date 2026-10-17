# Effect

- Follow root `AGENTS.md` and `../../docs/effect-architecture.md`; Web business functions return Effects and public schemas use Effect Schema.
- TanStack Start route handlers, server functions and React event handlers execute Effects at their boundary; keep routing, React state, CSS/Motion and HTTP/SSE contracts in their native APIs.
- Propagate request AbortSignals to Effect execution and SDK adapters. Request-bound fibers must never be shared across visitors; single-row content reads are idempotent and are executed directly at each call site.
