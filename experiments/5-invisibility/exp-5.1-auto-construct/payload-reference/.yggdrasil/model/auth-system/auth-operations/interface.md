# Auth Operations — Interface

## loginOperation

```typescript
loginOperation<TSlug extends AuthCollectionSlug>(args: {
  collection: Collection;
  data: AuthOperationsFromCollectionSlug<TSlug>['login'];
  depth?: number;
  overrideAccess?: boolean;
  req: PayloadRequest;
  showHiddenFields?: boolean;
}): Promise<LoginResult<TSlug>>
```

**Return:** `{ exp?: number; token?: string; user?: DataFromCollectionSlug<TSlug> }`

**Failure Modes:**
- `Forbidden` — if `disableLocalStrategy` is true
- `ValidationError` — missing email/username/password based on login config
- `AuthenticationError` — wrong password or user not found
- `LockedAuth` — account locked due to brute-force protection
- `UnverifiedEmail` — email verification required but not verified

## checkLoginPermission

```typescript
checkLoginPermission<TSlug>({ loggingInWithUsername?, req, user }): void
```

Throws `AuthenticationError` if user is null, `LockedAuth` if user is locked. Does not check login attempts — only lock status.

## logoutOperation

```typescript
logoutOperation(args: { allSessions?: boolean; collection: Collection; req: PayloadRequest }): Promise<boolean>
```

Returns `true` on success. If `allSessions` is true, removes all sessions; otherwise removes only the current session (by `_sid`).

**Failure Modes:**
- `APIError(400)` — no user on request
- `APIError(403)` — user collection doesn't match

## refreshOperation

```typescript
refreshOperation(args: { collection: Collection; req: PayloadRequest }): Promise<Result>
```

**Return:** `{ exp: number; refreshedToken: string; setCookie?: boolean; strategy?: string; user: Document }`

Extends session expiration, issues new JWT. Collection `refresh` hooks can override the entire result.

**Failure Modes:**
- `Forbidden` — no authenticated user, or sessions enabled but no valid session

## forgotPasswordOperation

```typescript
forgotPasswordOperation<TSlug>(args: {
  collection: Collection;
  data: { email?: string; username?: string };
  disableEmail?: boolean;
  expiration?: number;
  overrideAccess?: boolean;
  req: PayloadRequest;
}): Promise<null | string>
```

Returns the reset token string, or `null` if user not found (silent failure to prevent email enumeration).

## resetPasswordOperation

```typescript
resetPasswordOperation<TSlug>(args: {
  collection: Collection;
  data: { password: string; token: string };
  depth?: number;
  overrideAccess?: boolean;
  req: PayloadRequest;
}): Promise<{ token?: string; user: Record<string, unknown> }>
```

**Failure Modes:**
- `APIError(400)` — missing token or password
- `Forbidden` — disableLocalStrategy
- `APIError(403)` — invalid or expired token
