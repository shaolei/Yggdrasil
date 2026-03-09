# Token Management — Interface

## jwtSign

```typescript
jwtSign({ fieldsToSign, secret, tokenExpiration }): Promise<{ exp: number, token: string }>
```

Signs a JWT using HS256 via the jose library. Sets `iat` and `exp` claims. Returns the signed token string and expiration timestamp.

## getFieldsToSign

```typescript
getFieldsToSign({ collectionConfig, email, sid?, user }): Record<string, unknown>
```

Builds the JWT payload by starting with `{ id, collection, email }`, optionally adding `sid` (session ID), then traversing all collection fields. Fields with `saveToJWT: true` are included; `saveToJWT: false` are excluded; `saveToJWT: "customName"` renames the key. Groups and tabs are traversed recursively, respecting the `saveToJWT` setting at each level.

**Fix from git history**: Crash when user documents are missing group/tab fields (created before those fields were added to schema). Fixed with nullish coalescing (`?? {}`) — from commit 9f0c101.

## addSessionToUser

```typescript
addSessionToUser({ collectionConfig, payload, req, user }): Promise<{ sid?: string }>
```

If `useSessions` is enabled: generates a UUID session ID, calculates expiration from `tokenExpiration`, removes expired sessions, appends new session, persists to DB. Sets `updatedAt` to null to prevent spurious timestamp changes. Returns `{ sid }`. If sessions disabled, returns `{}`.

## revokeSession

```typescript
revokeSession({ collectionConfig, payload, req, sid, user }): Promise<void>
```

Filters out the session matching `sid` from user's sessions array and persists to DB. No-op if sessions disabled or user has no sessions.

## removeExpiredSessions

```typescript
removeExpiredSessions(sessions: UserSession[]): UserSession[]
```

Filters sessions to only those with `expiresAt` in the future.

## generatePayloadCookie / generateExpiredPayloadCookie

```typescript
generatePayloadCookie({ collectionAuthConfig, cookiePrefix, returnCookieAsObject?, token }): string | CookieObject
generateExpiredPayloadCookie({ collectionAuthConfig, cookiePrefix, returnCookieAsObject? }): string | CookieObject
```

Generates cookie string or object for auth token storage. Uses collection's cookie config (sameSite, secure, domain). Expired variant sets expiry to 1 second in the past (for logout).

## parseCookies

```typescript
parseCookies(headers: Headers): Map<string, string>
```

Parses the Cookie header. Adapted from Vercel's edge-runtime (MIT licensed).

## encrypt / decrypt

```typescript
encrypt(text: string): string  // uses this.secret
decrypt(hash: string): string  // uses this.secret
```

AES-256-CTR encryption/decryption. Note: these use `this.secret` binding (function context), not a parameter.

## Failure Modes

- `getFieldsToSign` could crash on missing group/tab data if user was created before fields were added — mitigated by nullish coalescing fix
- `addSessionToUser` writes to DB even if only cleaning expired sessions — always writes when sessions are enabled
