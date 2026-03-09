# Auth Infrastructure — Interface

## Password Hashing

### authenticateLocalStrategy

```typescript
authenticateLocalStrategy({ doc, password }): Promise<Doc | null>
```

Verifies a password against the stored hash/salt on the document. Uses pbkdf2 (25000 iterations, 512-byte key, sha256) + `crypto.timingSafeEqual`. Returns the document if valid, `null` if invalid or missing hash/salt. Swallows all errors (returns null).

### generatePasswordSaltHash

```typescript
generatePasswordSaltHash({ collection, password, req }): Promise<{ hash: string; salt: string }>
```

Generates a new salt (32 random bytes) and hash for a password. Validates password against collection's validation rules first.

**Failure:** `ValidationError` if password fails validation.

## JWT Operations

### jwtSign

```typescript
jwtSign({ fieldsToSign, secret, tokenExpiration }): Promise<{ exp: number; token: string }>
```

Signs a JWT with HS256. `tokenExpiration` is in seconds. Returns the token string and Unix expiration timestamp.

### extractJWT

```typescript
extractJWT({ headers, payload }): null | string
```

Extracts JWT from request using configurable order (`payload.config.auth.jwtOrder`). Supports:
- `Bearer` — `Authorization: Bearer <token>` (RFC6750)
- `JWT` — `Authorization: JWT <token>` (Payload legacy format)
- `cookie` — reads from `<cookiePrefix>-token` cookie, with CSRF origin validation

Returns first successful extraction or null.

### getFieldsToSign

```typescript
getFieldsToSign({ collectionConfig, email, sid?, user }): Record<string, unknown>
```

Builds JWT payload by traversing collection fields. Always includes `id`, `collection`, `email`. Adds `sid` if sessions enabled. Includes/excludes fields based on `saveToJWT` config (boolean or string alias).

## Session Management

### addSessionToUser

```typescript
addSessionToUser({ collectionConfig, payload, req, user }): Promise<{ sid?: string }>
```

If `useSessions` is enabled: generates UUID session ID, sets expiry based on `tokenExpiration`, cleans expired sessions, writes to DB. Sets `user.updatedAt = null` to prevent timestamp change. Returns `{ sid }` or `{}`.

### revokeSession

```typescript
revokeSession({ collectionConfig, payload, req, sid, user }): Promise<void>
```

Removes a specific session by ID from the user's sessions array. No-op if sessions not enabled.

### removeExpiredSessions

```typescript
removeExpiredSessions(sessions: UserSession[]): UserSession[]
```

Filters out sessions where `expiresAt` is in the past. Pure function.

## Cookie Generation

### generatePayloadCookie

```typescript
generatePayloadCookie({ collectionAuthConfig, cookiePrefix, returnCookieAsObject?, token }): string | CookieObject
```

Generates an HttpOnly cookie with the JWT token. Cookie name: `<cookiePrefix>-token`. Attributes sourced from `collectionAuthConfig.cookies` (domain, secure, sameSite).

### generateExpiredPayloadCookie

Same as above but sets expiry to 1 second in the past (for logout).

## Crypto

### encrypt / decrypt

```typescript
encrypt(text: string): string  // bound to payload instance (this.secret)
decrypt(hash: string): string  // bound to payload instance (this.secret)
```

AES-256-CTR encryption. IV is prepended to ciphertext as hex. Uses `this.secret` (must be called with correct binding).

## Authentication Strategies

### JWTAuthentication

```typescript
JWTAuthentication({ headers, isGraphQL?, payload, strategyName? }): Promise<{ user: AuthStrategyResult['user'] }>
```

1. Extract JWT from request
2. If no token: try autoLogin (development mode), else return null
3. Verify JWT with jose, decode payload
4. Find user by decoded ID
5. If sessions enabled: validate session ID from JWT exists in user's sessions
6. If user valid and verified: return user with collection and strategy metadata

Falls back to autoLogin on any error or invalid user.

### APIKeyAuthentication

```typescript
APIKeyAuthentication(collectionConfig): AuthStrategyFunction
```

Factory function returning a strategy. Checks `Authorization: <slug> API-Key <key>` header. Computes both SHA-1 and SHA-256 HMAC of the key (backward compatibility with pre-v3.46.0). Queries user by `apiKeyIndex` match. Respects `_verified` if verification enabled.

### incrementLoginAttempts / resetLoginAttempts

```typescript
incrementLoginAttempts({ collection, payload, user }): Promise<void>
resetLoginAttempts({ collection, doc, payload, req }): Promise<void>
```

See brute-force-protection aspect for behavioral details. Note: `incrementLoginAttempts` deliberately does NOT take `req` to operate outside the request transaction.
