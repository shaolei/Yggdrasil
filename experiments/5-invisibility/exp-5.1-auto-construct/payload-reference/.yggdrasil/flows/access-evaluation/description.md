# Access Evaluation

## Business context

Before any data operation (create, read, update, delete) and for admin UI permission display, the system evaluates whether the current user has permission. This evaluation supports both simple boolean access and row-level security via Where queries.

## Trigger

Two entry points: (1) `executeAccess` during a data operation, (2) `getAccessResults` → `getEntityPermissions` for permission introspection (GET `/access` endpoint, admin UI).

## Goal

Determine what the current user is allowed to do across all collections and globals, at both entity level and field level.

## Participants

- **Access Control** — provides `executeAccess` (single operation check) and `getAccessResults` (full permission map)
- **Entity Permissions** — builds detailed permission objects for entities including field-level and block-level permissions

## Paths

### Operation-level access check (executeAccess)

1. Caller provides an access function and operation context (req, id, data)
2. If access function exists: invoke it, throw Forbidden if result is falsy (unless `disableErrors`)
3. If no access function: allow if user is authenticated, deny otherwise
4. Return the access result (boolean or Where query)

### Full permission introspection (getAccessResults)

1. System iterates all collections and globals in config
2. For each entity, determines applicable operations (CRUD + unlock for auth collections + readVersions for versioned entities)
3. Calls `getEntityPermissions` which:
   a. Phase 1: Invokes all entity-level access functions in parallel
   b. Phase 2: Processes Where query results with caching (deep equality) and optional DB evaluation
   c. Phase 3: Recursively populates field-level permissions (inheriting from parent when no field-level access function)
4. Admin access (`canAccessAdmin`) is evaluated separately — only for the admin user collection
5. Results are sanitized before return

### Field permission evaluation

1. For each field, check if it has an operation-specific access function
2. If yes: invoke it (supports both sync and async results via `isThenable` check)
3. If no: inherit permission from parent (entity or parent field)
4. Block fields use a caching mechanism: identical block references share permission objects
5. Nested fields (groups, tabs, arrays, blocks) recurse with the parent's permissions as context
6. Promise collection uses an iterative drain pattern (while loop with 100-iteration safety limit)

## Invariants across all paths

- Field-level permissions never include `siblingData` or `blockData` (schema-level permissions, not row-level)
- When no access function is defined, default permission is based on `isLoggedIn`
- Where query cache uses `isDeepStrictEqual` for matching
- Operations not applicable to fields (delete, readVersions, unlock) are skipped during field permission evaluation
