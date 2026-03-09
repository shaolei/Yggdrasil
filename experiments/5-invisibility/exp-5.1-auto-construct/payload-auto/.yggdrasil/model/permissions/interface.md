# Entity Permissions — Interface

## getEntityPermissions

```typescript
getEntityPermissions<TEntityType extends 'collection' | 'global'>(
  args: Args<TEntityType>
): Promise<ReturnType<TEntityType>>
```

Builds a complete permissions object for a collection or global.

**Parameters:**
- `entity` — sanitized collection or global config
- `entityType` — `'collection'` or `'global'`
- `operations` — list of operations to check (e.g., `['create', 'read', 'update', 'delete']`)
- `fetchData` — if true, Where-query results are evaluated against DB; if false, Where queries default to `permission: true`
- `id` — required when `fetchData: true` and `entityType: 'collection'`
- `data` — optional pre-fetched document data (skips DB fetch)
- `blockReferencesPermissions` — shared cache for block reference permissions across entities
- `req` — request context with user

**Returns:** `CollectionPermission` or `GlobalPermission` with nested `fields` permissions

**Behavior:**
- Phase 1: Resolves all top-level access functions in parallel
- Phase 2: Processes Where-query results — uses cache with deep equality check; deduplicates DB calls
- Phase 3: Recursively populates field permissions via `populateFieldPermissions`
- Phase 4: Drains promise queue (which can grow during recursion) until empty, with 100-iteration safety limit

## populateFieldPermissions

```typescript
populateFieldPermissions(args): void  // synchronous, collects async work into promises array
```

Recursively walks the field tree and builds permissions. Handles: named fields, unnamed groups (transparent), blocks, block references (with caching), tabs (named and unnamed). Async access function results are collected as promises and resolved externally.

## entityDocExists

```typescript
entityDocExists(args): Promise<boolean>
```

Checks if an entity document exists matching a Where query. For globals: uses `findGlobal`. For collections: uses `count` (or `countVersions` for `readVersions` operation). Combines the access Where with the document ID.

## Failure Modes

- Infinite recursion protection: throws after 100 iterations of promise draining
- Missing `id` when `fetchData: true` for collections: throws Error
