# Entity Permissions — Internals

## Logic

### Two-Phase Access Resolution

Phase 1 fires all access functions concurrently using `Promise.resolve(accessFunction(...))`. Phase 2 processes the results — boolean results are assigned directly; Where-query results go through `processWhereQuery`.

### Where Query Caching

`processWhereQuery` maintains a `whereQueryCache` array. Before issuing a DB call, it checks for an existing entry with `isDeepStrictEqual` (from Node.js `util`). Cache hits reuse the same Promise, so identical Where queries across different operations share one DB call.

### Field Permission Recursion

`populateFieldPermissions` is synchronous — it collects all async work (access function calls) into a shared `promises` array. The caller drains this array in a while loop. Crucially, promise resolution can add MORE promises (e.g., when processing a group field triggers nested `populateFieldPermissions` calls), so the loop repeats until the array is empty.

Field types and their permission behavior:
- **Named fields with access function**: access function result (may be async)
- **Named fields without access function**: inherits parent permission (may be a Promise)
- **Unnamed groups**: transparent — children use parent permissions object
- **Blocks**: each block gets its own permissions; block references are cached in `blockReferencesPermissions`
- **Named tabs**: act like named fields (own permissions)
- **Unnamed tabs**: transparent — like unnamed groups

### Block Reference Caching

When a block is referenced by string (block reference), its permissions are cached in `blockReferencesPermissions`. Subsequent references to the same block slug reuse the cached object. The `setPermission` helper mutates the permission object in place (via `.then()`) so all references see the resolved value.

### fetchData=false Where Behavior

When `fetchData` is false and an access function returns a Where query, it's stored with `permission: true`. A TODO comment (from the code) notes this should potentially default to `false` in v4.0 for security, or use a third state like `'unknown'`.

## Constraints

- `siblingData` and `blockData` are never passed to access functions in this context — the code comment explains this is because "we're calculating schema permissions, which do not include individual rows"
- Maximum 100 iterations of promise draining (safety valve against infinite loops)
- `delete`, `readVersions`, and `unlock` operations are skipped for field-level permissions (they only apply at entity level)

## Decisions

- **Chose synchronous field traversal with async collection over fully async recursion**: rationale: unknown — inferred from code. The pattern allows the entire field tree to be walked in one synchronous pass, with all async work batched and awaited at the end. This may reduce overhead vs. awaiting at each recursion level.
- **Where with fetchData=false defaults to permission: true**: TODO in code questions this for v4.0. Current behavior means permissions are optimistic when document data is not available.
