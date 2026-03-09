# Auth Strategies

## Responsibility

Implements authentication strategy pipeline and individual strategies. The pipeline (`executeAuthStrategies`) iterates through configured strategies until one returns a user. Individual strategies handle different auth mechanisms.

## Strategies

- **JWT** (`strategies/jwt.ts`): Extracts JWT from request, verifies signature, looks up user, validates session and email verification. Falls back to autoLogin if configured.
- **API Key** (`strategies/apiKey.ts`): Checks Authorization header for `<collection> API-Key <key>` format. Hashes key with HMAC and looks up by `apiKeyIndex`. Checks both SHA-1 and SHA-256 for backward compatibility (pre-v3.46.0 keys used SHA-1; TODO: remove SHA-1 in v4).
- **Local** (`strategies/local/`): Password hashing (pbkdf2, 25k iterations, sha256, 512-byte key), login attempt tracking, password salt generation, user registration.

## Not Responsible For

- Custom auth strategies (those are user-defined and injected via config)
- Cookie generation (delegated to cookies module)
- Token signing (delegated to jwt module; strategies only verify)
