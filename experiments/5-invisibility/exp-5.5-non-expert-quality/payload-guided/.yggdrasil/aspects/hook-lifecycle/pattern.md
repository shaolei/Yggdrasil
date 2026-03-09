# Hook Lifecycle Pattern

## What

All auth operations that modify or return data follow a consistent hook execution order:

1. `beforeOperation` collection hook
2. Main operation logic (credential verification, token signing, etc.)
3. Operation-specific hooks (e.g., `beforeLogin`, `afterLogin`)
4. `afterRead` field hooks (for transforming user data)
5. `afterRead` collection hooks
6. `afterOperation` collection hook

## Why

This pattern allows Payload users to customize auth behavior at well-defined extension points without modifying core code. Each hook position has a specific purpose: beforeOperation can reject or modify args, operation-specific hooks can modify the user or result, afterRead hooks transform data for the consumer.

## Constraints

- Hooks execute sequentially within each phase (not in parallel)
- Each hook can modify the user object; the result of one hook feeds into the next
- If a hook returns a falsy value, the original value is preserved (the `|| user` pattern)
