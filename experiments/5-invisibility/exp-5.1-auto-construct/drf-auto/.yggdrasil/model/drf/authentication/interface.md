# Authentication — Interface

## Base Class

### `BaseAuthentication`
Abstract base. All authentication classes must extend this.

#### `authenticate(request) -> (user, auth) | None`
Returns a two-tuple of (user, token/credentials) if authentication succeeds, or `None` if this authenticator does not apply to the request (allowing the next authenticator to try). Raises `AuthenticationFailed` if credentials are present but invalid.

#### `authenticate_header(request) -> str | None`
Returns a string for the `WWW-Authenticate` header in 401 responses. If `None`, the view coerces the response to 403 instead of 401.

## Built-in Implementations

### `BasicAuthentication`
HTTP Basic auth. Decodes base64 `Authorization: Basic <credentials>` header, splits into userid:password, authenticates via Django's `authenticate()`.
- `www_authenticate_realm` = `'api'`
- Handles both UTF-8 and Latin-1 encoded credentials (commit `d7b218f5` #7193)
- `authenticate_credentials(userid, password, request=None)` — extensible hook

### `SessionAuthentication`
Uses Django's session framework. Reads user from `request._request.user` (the Django-level session user). Enforces CSRF for authenticated requests via `enforce_csrf()`.
- Returns `None` for unauthenticated or inactive users (skipping CSRF check)
- CSRF failure raises `PermissionDenied` with descriptive message

### `TokenAuthentication`
Token-based auth via `Authorization: Token <key>` header.
- `keyword` = `'Token'` (customizable per commit `ffdac0d9` #4097)
- `model` — custom token model support (must have `key` and `user` attributes)
- Uses `select_related('user')` for efficient DB query (commit `58e7bbc8`)
- `get_model()` — lazy import of `rest_framework.authtoken.models.Token` (commit `ff29fdd8`)

### `RemoteUserAuthentication`
Delegates to web server authentication via `REMOTE_USER` header.
- `header` = `'REMOTE_USER'` (customizable)
- Calls Django's `authenticate(request=request, remote_user=...)` (commit `655e803a` #7158)

## Utility Functions

### `get_authorization_header(request) -> bytes`
Extracts `HTTP_AUTHORIZATION` from request META. Handles Django test client oddness where the header may be a unicode string instead of bytes.

## Failure Modes

- Invalid Basic credentials (wrong format, bad base64) → `AuthenticationFailed`
- Invalid username/password → `AuthenticationFailed`
- Inactive user → `AuthenticationFailed`
- Invalid token → `AuthenticationFailed`
- CSRF validation failure → `PermissionDenied` (not `AuthenticationFailed`)
