# JWT

## Responsibility

JWT token signing and extraction from HTTP requests.

## Key Behaviors

- `jwtSign`: Signs a JWT using jose library with HS256 algorithm. Returns `{ exp, token }`.
- `extractJWT`: Extracts JWT from request headers using configurable extraction order (`payload.config.auth.jwtOrder`). Supports three methods:
  - **cookie**: extracts from `{cookiePrefix}-token` cookie, validates Origin against CSRF whitelist
  - **Bearer**: extracts from `Authorization: Bearer <token>` header (RFC6750 compliant)
  - **JWT**: extracts from `Authorization: JWT <token>` header (Payload's original format)

## Security

- Cookie extraction includes CSRF protection: if Origin header is present and CSRF list is non-empty, the origin must be whitelisted
- No Origin header (server-to-server) or empty CSRF list allows all requests
- Bearer and JWT extraction do not need CSRF checks (tokens cannot be auto-sent by browsers)
