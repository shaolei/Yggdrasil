# Hook Lifecycle Pattern

## What

Every auth operation follows a standardized lifecycle:

1. `buildBeforeOperation` — runs collection's `beforeOperation` hooks, may mutate args
2. Core operation logic
3. Operation-specific hooks (e.g., `beforeLogin`, `afterLogin`, `afterForgotPassword`, `afterRefresh`, `afterLogout`)
4. `afterRead` — field-level hooks for user document
5. `buildAfterOperation` — runs collection's `afterOperation` hooks, may mutate result

Hooks can replace the user object or the result by returning a new value. A hook returning falsy preserves the existing value (`|| user` / `|| result` pattern).

## Why

Payload CMS is a framework where collections are user-defined. The hook system allows collection authors to inject custom behavior (e.g., audit logging, custom token fields, rate limiting) without modifying core auth logic. The standardized lifecycle ensures predictable ordering.

## Constraints

- Hooks run sequentially (for loop), not in parallel. Order matters.
- Each hook receives the full `req` context object, enabling cross-cutting concerns.
- `beforeOperation` hooks can mutate `args` (the entire operation arguments).
- `afterOperation` hooks can mutate `result`.
