# Access Control Pattern

## What

Every entity (collection or global) has per-operation access functions. These functions receive the request context (user, data, id) and return either:

- `true` / `false` — grant or deny access outright
- A `Where` query object — conditional access based on document-level constraints

When no access function is defined, the default behavior is: logged-in users have access, anonymous users do not.

## Why

This allows Payload users to define fine-grained, document-level authorization without writing middleware. Access control is declarative and co-located with the collection/global config.

rationale: unknown — inferred from code, not confirmed by developer. The pattern is consistent across executeAccess, getEntityPermissions, and defaultAccess.

## Rules

1. Access functions are async-compatible — results are always awaited.
2. A `Where` result with `fetchData: false` is treated as `permission: true` (the where is stored but not evaluated). A TODO comment in the code questions whether this should default to `false` in v4.0.
3. Field-level access inherits from parent entity permission when no field-specific access function is defined.
4. Block reference permissions are cached and shared across fields that reference the same block.
