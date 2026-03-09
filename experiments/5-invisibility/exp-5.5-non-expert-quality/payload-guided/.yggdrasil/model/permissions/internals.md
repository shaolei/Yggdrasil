# Entity Permissions Internals

## Two-Phase Resolution

1. **Phase 1**: All entity-level access functions are called in parallel (Promise.all). Results are either booleans or Where queries.
2. **Phase 2**: Where queries are processed — either evaluated against DB (fetchData=true) or stored as-is (fetchData=false). A cache prevents duplicate DB queries for identical Where objects (using `isDeepStrictEqual`).

After entity-level permissions, `populateFieldPermissions` runs synchronously to set up field permissions, collecting async work into a promises array.

## Promise Loop

The main function processes promises in a while loop because nested fields can add more promises to the array during resolution. This continues until no new promises are added. A safety cap at 100 iterations prevents infinite loops.

## Permission Inheritance

- Fields with an access function: run the function, use the result
- Fields without an access function: inherit from parent permission (which may itself be a promise)
- Unnamed groups/tabs: use the parent's permissions object directly (no new nesting level)
- Named groups/tabs: get their own permissions entry

## Block Reference Caching

Block references (shared block types) use `blockReferencesPermissions` cache. The permission object is stored by reference, so when the promise resolves and mutates the `permission` property in place, all references see the update simultaneously.

## Decisions

- **Chose to not include siblingData/blockData in field access function calls** over including them because when calculating schema-level permissions (not per-row), siblingData is unavailable for block/array rows. For consistency, it's never included.

- **Chose `permission: true` for unevaluated Where queries (fetchData=false)** — this is acknowledged as potentially insecure. TODO for v4 considers defaulting to false or introducing a third state ('unknown').
