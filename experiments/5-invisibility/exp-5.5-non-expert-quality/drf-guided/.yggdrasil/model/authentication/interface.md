# Authentication — Interface

## BaseAuthentication

### authenticate(request) → (user, auth) | None
Identify the user from the request. Returns:
- `(user, auth_info)` tuple on success
- `None` if this authenticator does not apply (wrong scheme)
- Raises `AuthenticationFailed` on invalid credentials

### authenticate_header(request) → str | None
Return a WWW-Authenticate header value for 401 responses. If `None`, auth failures produce 403 instead of 401.

## Built-in Classes

### BasicAuthentication
- Scheme: HTTP Basic (Authorization: Basic base64)
- Returns: `(user, None)`
- Header: `Basic realm="api"`
- Validates via Django's `authenticate()` function

### SessionAuthentication
- Scheme: Django session cookies
- Returns: `(user, None)` if session has active user
- Header: None (so failures become 403, not 401)
- Enforces CSRF for authenticated session requests

### TokenAuthentication
- Scheme: Token header (Authorization: Token xxx)
- Returns: `(user, token)`
- Header: `Token`
- Looks up token in database via `Token` model

### RemoteUserAuthentication
- Scheme: REMOTE_USER environment variable (set by web server)
- Returns: `(user, None)`
- Header: None

## Failure Modes
- `AuthenticationFailed` — invalid/malformed credentials (stops the authentication chain immediately)
- `PermissionDenied` — CSRF failure in SessionAuthentication (raised as permission error, not auth error)
