# Auth Strategies Interface

## executeAuthStrategies

```typescript
executeAuthStrategies(args: AuthStrategyFunctionArgs): Promise<AuthStrategyResult>
```

Iterates through `payload.authStrategies` array, calling each strategy's `authenticate` method. Returns the first successful result (where `user` is non-null). If a strategy throws, the error is logged and the next strategy is tried. Response headers from all strategies are merged.

Returns `{ user: null }` if no strategy authenticates.

## JWTAuthentication

```typescript
JWTAuthentication(args: AuthStrategyFunctionArgs): Promise<AuthStrategyResult>
```

Extracts JWT from request (using configurable extraction order), verifies signature with `payload.secret`, looks up user, validates email verification and session. Falls back to `autoLogin` if configured and no token found.

**Session validation**: If `useSessions` is enabled, the session ID from the JWT (`sid`) must match an existing session on the user document. If not, returns `{ user: null }`.

## APIKeyAuthentication

```typescript
APIKeyAuthentication(collectionConfig): AuthStrategyFunction
```

Factory function — returns an auth strategy for a specific collection. Checks for `Authorization: <slug> API-Key <key>` header. Hashes key with HMAC-SHA256 (and SHA-1 for backward compat) and queries for matching `apiKeyIndex`.

## authenticateLocalStrategy

```typescript
authenticateLocalStrategy({ doc, password }): Promise<Doc | null>
```

Verifies password against stored hash using pbkdf2 (25k iterations, sha256, 512-byte key). Uses `crypto.timingSafeEqual` for constant-time comparison. Returns the doc on success, null on failure.

## incrementLoginAttempts

```typescript
incrementLoginAttempts({ collection, payload, user }): Promise<void>
```

Increments the user's login attempt count using atomic `$inc`. Locks the account when max attempts reached. Handles parallel attempt scenarios by operating outside transaction context. Purges sessions created in last 20 seconds on brute force detection.
