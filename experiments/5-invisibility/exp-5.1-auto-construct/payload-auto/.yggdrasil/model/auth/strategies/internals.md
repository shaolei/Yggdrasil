# Auth Strategies — Internals

## Logic

### JWT Extraction Order

JWT extraction follows a configurable order defined in `config.auth.jwtOrder`. Three extraction methods exist:
- `cookie` — reads from `{cookiePrefix}-token` cookie, validates CSRF origin
- `Bearer` — RFC6750 OAuth 2.0 Bearer token from Authorization header
- `JWT` — Payload's own `JWT <token>` format from Authorization header

### API Key Backward Compatibility

API keys are HMAC'd before storage/lookup (never stored raw). The current algorithm is SHA-256, but keys created before v3.46.0 used SHA-1. The lookup checks both hashes with an OR query. A TODO comment marks this dual check for removal in v4.0.

### Password Hashing

Uses Node.js `crypto.pbkdf2` with:
- 25,000 iterations
- 512-byte derived key length
- SHA-256 digest
- Random 32-byte salt per user

`crypto.timingSafeEqual` prevents timing side-channel attacks on hash comparison.

## Decisions

- **Chose PBKDF2 over bcrypt/scrypt**: rationale: unknown — inferred from code. PBKDF2 is built into Node.js crypto, avoiding native dependencies.
- **Chose to swallow all errors in authenticateLocalStrategy**: The catch block returns null instead of propagating. This prevents leaking information about whether a user exists via different error responses.
- **API key dual-hash lookup (SHA-1 + SHA-256)**: Backward compatibility with pre-v3.46.0. Marked for removal in v4.0 (from code TODO comment).

## State

- Strategy executor iterates in configured order, stops at first match — last strategy wins on the user object
- Auto-login is a development convenience feature gated by `config.admin.autoLogin` and `DisableAutologin` header
