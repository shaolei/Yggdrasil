# Auth Strategies — Interface

## executeAuthStrategies

```typescript
executeAuthStrategies(args: AuthStrategyFunctionArgs): Promise<AuthStrategyResult>
```

Iterates through `payload.authStrategies` in order. Returns the first successful result (where `user` is non-null). If all strategies fail, returns `{ user: null }`. Errors within individual strategies are logged but do not halt iteration.

## JWTAuthentication

```typescript
JWTAuthentication(args: AuthStrategyFunctionArgs): Promise<AuthStrategyResult>
```

1. Extracts JWT from request (cookie, Authorization header — configurable order via `config.auth.jwtOrder`)
2. If no token found: falls back to auto-login (if configured and not disabled by `DisableAutologin` header)
3. Verifies JWT using jose library with HS256
4. Fetches user by decoded ID from the token's collection
5. If sessions are enabled: validates that the session ID from the token exists on the user
6. Returns user with `_strategy: 'local-jwt'` and `collection` set

## APIKeyAuthentication

```typescript
APIKeyAuthentication(collectionConfig): AuthStrategyFunction
```

Factory function — returns a strategy bound to a specific collection. Looks for `Authorization: <slug> API-Key <key>` header. Computes both SHA-1 and SHA-256 HMAC of the key (for backward compatibility with pre-v3.46.0 keys). Checks `_verified` if verification is enabled.

## authenticateLocalStrategy

```typescript
authenticateLocalStrategy({ doc, password }): Promise<Doc | null>
```

Verifies password against stored salt+hash using PBKDF2 (25,000 iterations, SHA-256, 512-byte key). Uses `crypto.timingSafeEqual` for constant-time comparison. Returns the doc on success, null on failure. Swallows all errors to prevent timing attacks.

## Failure Modes

- Invalid JWT: returns `{ user: null }`, falls back to auto-login
- Invalid API key: returns `{ user: null }`
- Wrong password: returns `null` (caller handles error throwing)
- Unverified user with valid JWT: returns `{ user: null }`
- Session not found (sessions enabled): returns `{ user: null }`
