# Access Control — Interface

## executeAccess

```typescript
executeAccess(
  args: { id?: number | string; data?: any; disableErrors?: boolean; isReadingStaticFile?: boolean; req: PayloadRequest },
  access: Access
): Promise<AccessResult>
```

Invokes a single access function with the given context. Returns the result (boolean or Where query object).

**Parameters:**
- `access` — the access function to invoke (from collection/global config)
- `id` — optional document ID for document-level checks
- `data` — optional document data
- `disableErrors` — if true, returns false instead of throwing Forbidden
- `isReadingStaticFile` — flag for static file access checks
- `req` — the Payload request containing user, locale, etc.

**Return:** `AccessResult` — `true`, `false`, or a `Where` query object

**Failure Modes:**
- Throws `Forbidden` when access is denied and `disableErrors` is false
- If no access function provided and no user on req, throws `Forbidden` (or returns false if errors disabled)

**Fallback behavior:** When `access` is undefined/null, falls back to checking `req.user` — authenticated users pass, unauthenticated fail.

## defaultAccess

```typescript
defaultAccess({ req: { user } }: { req: PayloadRequest }): boolean
```

Returns `true` if user exists, `false` otherwise. Used as the default access function when none is configured.

## getAccessResults

```typescript
getAccessResults({ req }: { req: PayloadRequest }): Promise<SanitizedPermissions>
```

Builds complete permission map for the current user across all collections and globals.

**Return:** `SanitizedPermissions` — object with `canAccessAdmin`, `collections`, and `globals` keys, each containing per-operation permissions and nested field permissions.

**Behavior:**
- Iterates all collections: checks CRUD operations, plus `unlock` (if maxLoginAttempts configured) and `readVersions` (if versions enabled)
- Iterates all globals: checks read, update, and readVersions
- `canAccessAdmin` is only true for users in the designated admin collection with passing admin access function
- Results are sanitized via `sanitizePermissions` before return

## accessOperation

```typescript
accessOperation({ req }: { req: PayloadRequest }): Promise<SanitizedPermissions>
```

Thin wrapper around `getAccessResults` that adds telemetry tracking and transaction error handling. Called by the `/access` endpoint.
