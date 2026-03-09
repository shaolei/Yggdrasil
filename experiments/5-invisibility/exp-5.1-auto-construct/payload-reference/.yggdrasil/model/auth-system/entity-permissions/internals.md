# Entity Permissions — Internals

## Logic

### Two-phase access evaluation

Phase 1: All entity-level access functions are invoked in parallel (`Promise.resolve(accessFunction(...))` collected, then `Promise.all`).

Phase 2: Results are processed:
- Boolean results → set permission directly
- Where objects → either evaluated via DB (fetchData=true) or stored as-is (fetchData=false)

Where query cache uses `isDeepStrictEqual` for deep comparison. Identical Where queries share the same DB promise, avoiding duplicate queries.

### Field permission propagation

The synchronous `populateFieldPermissions` traverses the field tree:

1. For each named field: check if it has an operation-specific access function
2. If it does: call it (may return sync boolean or promise)
3. If not: inherit from `parentPermissionsObject[operation].permission` (which may itself be a promise)
4. For nested structures (groups, tabs, blocks): recurse with the field's permissions as the new parent

The `setPermission` helper handles the sync/async duality:
- Sync: creates `{ permission: value }` directly
- Async: creates `{ permission: promiseRef }`, pushes a `.then()` that mutates `permission` in place

This in-place mutation is critical for block reference caching — all references to the same block permission object see the resolved value.

### Promise drain loop

After `populateFieldPermissions` returns synchronously, the promises array contains all async access function calls. These are drained in a while loop:
- Each iteration splices current promises and awaits them
- Resolved promises may add new promises (e.g., a group field's access function resolves, triggering its children)
- Safety limit of 100 iterations prevents infinite loops

### fetchData=false Where behavior

When `fetchData` is false, Where query results are stored with `permission: true`. The TODO in code questions whether this should be `false` for security. Current behavior means the permission system is optimistic — it returns true and includes the Where query for the consumer to apply at query time.

### Block reference caching

Block references (`blockReferences` in field config) are resolved via `req.payload.blocks[_block]`. The first time a block slug is encountered, its permissions are computed and stored in `blockReferencesPermissions`. Subsequent encounters across any entity reuse the cached object.

The caching works because the permission object is mutated in place (via `setPermission`), so even if the cached reference was stored before promises resolved, it will have the correct values once all promises drain.

## Decisions

- Chose iterative promise drain over recursive async/await — rationale: unknown — inferred from code, likely to support dynamically-added promises from nested field access functions without deep recursion
- Chose synchronous field traversal with async collection over fully async traversal — rationale: unknown — inferred from code, likely performance optimization to batch all DB calls into single Promise.all
- Chose in-place mutation of permission objects over immutable approach — rationale: unknown — inferred from code, enables block reference caching where multiple consumers share the same permission object
- Chose deep equality (isDeepStrictEqual) for Where cache over reference equality — rationale: unknown — inferred from code, different access functions may return structurally identical Where objects
- Chose 100-iteration safety limit over no limit — rationale: unknown — inferred from code, defensive programming against infinite loops in recursive field structures
