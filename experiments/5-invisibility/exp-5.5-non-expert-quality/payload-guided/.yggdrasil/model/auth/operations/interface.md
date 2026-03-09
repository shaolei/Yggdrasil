# Auth Operations Interface

## loginOperation

```typescript
loginOperation<TSlug>(args: {
  collection: Collection
  data: { email?: string; username?: string; password: string }
  depth?: number
  overrideAccess?: boolean
  req: PayloadRequest
  showHiddenFields?: boolean
}): Promise<{ exp?: number; token?: string; user?: DataFromCollectionSlug<TSlug> }>
```

Authenticates a user with email/username + password. Returns JWT token, expiration, and user data.

**Failure modes:**
- `Forbidden` — local strategy is disabled
- `ValidationError` — required fields missing (email/username/password)
- `AuthenticationError` — invalid credentials or user not found
- `LockedAuth` — account locked due to too many failed attempts
- `UnverifiedEmail` — email verification required but not completed

## refreshOperation

```typescript
refreshOperation(args: { collection: Collection; req: PayloadRequest }): Promise<{
  exp: number; refreshedToken: string; setCookie?: boolean; user: Document
}>
```

Issues a new JWT token for an authenticated user. Extends session expiry.

**Failure modes:**
- `Forbidden` — user not authenticated, or session not found (when sessions enabled)

## logoutOperation

```typescript
logoutOperation(args: {
  allSessions?: boolean; collection: Collection; req: PayloadRequest
}): Promise<boolean>
```

Removes the current session (or all sessions if `allSessions` is true). Returns true on success.

**Failure modes:**
- `APIError(400)` — no user
- `APIError(403)` — user collection doesn't match
