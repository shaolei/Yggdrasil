# Auth Operations — Interface

## loginOperation

```typescript
loginOperation<TSlug>(args: Arguments<TSlug>): Promise<LoginResult<TSlug>>
```

Full login flow. Validates input, authenticates via local strategy, manages lockout, creates session, signs JWT, executes hooks. Returns `{ token, exp, user }`.

**Preconditions:**
- `disableLocalStrategy` must be false
- Email/username must be provided based on collection's `loginWithUsername` config
- Password must be a non-empty string

**Errors:** `Forbidden` (local strategy disabled), `ValidationError` (missing fields), `AuthenticationError` (wrong credentials), `LockedAuth` (account locked), `UnverifiedEmail` (verification required)

## executeAccess

```typescript
executeAccess(operationArgs: OperationArgs, access: Access): Promise<AccessResult>
```

Evaluates a single access function. If the function exists, calls it and returns the result (boolean or Where). If no function, falls back to `!!req.user`. Throws `Forbidden` if access denied and `disableErrors` is false.

## defaultAccess

```typescript
defaultAccess({ req }): boolean
```

Returns `Boolean(req.user)`. Used when no access function is configured.

## getAccessResults

```typescript
getAccessResults({ req }): Promise<SanitizedPermissions>
```

Builds the complete permissions map for the current user across all collections and globals. Delegates to `getEntityPermissions` for each entity. Returns sanitized permissions (Where queries stripped, only boolean flags).

## extractAccessFromPermission

```typescript
extractAccessFromPermission(hasPermission: boolean | Permission): AccessResult
```

Extracts an `AccessResult` (boolean or Where) from a `Permission` object.

## Failure Modes

- Transaction rollback: if any error occurs after session creation, the session is revoked and the transaction is killed
- Login with disabled local strategy: throws Forbidden immediately
- Missing email AND username: throws ValidationError with both paths
