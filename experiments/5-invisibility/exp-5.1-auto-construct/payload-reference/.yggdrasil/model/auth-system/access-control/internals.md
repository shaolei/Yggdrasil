# Access Control — Internals

## Logic

### executeAccess fallback chain

1. If `access` function exists → invoke it → if falsy result and errors enabled → throw Forbidden
2. If no `access` function → if `req.user` exists → return true
3. Otherwise → throw Forbidden (or return false)

This means a missing access function is NOT "deny all" — it is "allow authenticated users." This is the same behavior as `defaultAccess`.

### getAccessResults collection operations

Operations are determined per-collection:
- Always: `create`, `read`, `update`, `delete`
- If `collection.auth.maxLoginAttempts !== 0`: add `unlock`
- If `collection.versions`: add `readVersions`

For globals: always `read`, `update`; if `global.versions`: add `readVersions`.

### canAccessAdmin evaluation

Admin access is granted only when:
1. User's collection matches `payload.config.admin.user` (the designated admin collection)
2. If `userCollectionConfig.access.admin` function exists → invoke it
3. If no admin access function → default to `isLoggedIn`

Users from non-admin collections always get `canAccessAdmin: false`.

### Block reference permissions sharing

`getAccessResults` initializes a shared `blockReferencesPermissions` object that is passed through all `getEntityPermissions` calls. This allows block types referenced across multiple collections to share computed permissions rather than re-evaluating.

## Decisions

- Chose to default missing access functions to "allow authenticated" over "deny all" — rationale: unknown — inferred from code. This makes the framework permissive by default for logged-in users, reducing boilerplate for simple setups.
- Chose to run all collection/global permission evaluations in parallel via `Promise.all` over sequential evaluation — rationale: unknown — inferred from code, likely performance optimization for introspection endpoint.
