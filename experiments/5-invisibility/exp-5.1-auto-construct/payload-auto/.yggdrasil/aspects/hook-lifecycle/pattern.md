# Hook Lifecycle Pattern

## What

Auth operations follow a strict hook execution sequence defined by the collection config:

1. `beforeOperation` — can transform args before the operation runs
2. Operation-specific before hook (e.g., `beforeLogin`) — can modify user
3. Core operation logic
4. Operation-specific after hook (e.g., `afterLogin`) — can modify user, receives token
5. `afterRead` — field-level hooks for transforming the user document
6. `afterRead` (collection-level) — collection hooks
7. `afterOperation` — can transform the final result

## Why

rationale: unknown — inferred from code structure. The hook system allows Payload users to customize behavior at well-defined extension points without modifying core auth logic.

## Rules

1. Hooks execute sequentially (for-of loop), not in parallel.
2. Each hook can return a modified object or nothing (falsy returns keep the original).
3. Hook failures propagate — no try/catch around individual hooks.
