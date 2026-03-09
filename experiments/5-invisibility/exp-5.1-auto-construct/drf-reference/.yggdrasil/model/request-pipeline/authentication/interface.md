# Authentication — Interface

## BaseAuthentication (abstract)

### `authenticate(request) → tuple[User, auth] | None`

Examine the request and return a `(user, auth)` two-tuple if credentials are valid. Return `None` if this authenticator does not apply (e.g., no Authorization header matching its scheme). Raise `AuthenticationFailed` if credentials are present but invalid.

### `authenticate_header(request) → str | None`

Return a string for the `WWW-Authenticate` header in 401 responses. Return None if the scheme should produce 403 instead of 401. Only the first authenticator's header is used (via `APIView.get_authenticate_header`).

## BasicAuthentication

Authenticates via HTTP Basic (`Authorization: Basic <base64>`).

### `authenticate(request) → tuple[User, None] | None`

Parses the `Authorization` header. Returns None if not Basic. Raises `AuthenticationFailed` for malformed headers or invalid credentials. Decodes base64 as UTF-8 first, falls back to Latin-1.

### `authenticate_credentials(userid, password, request=None) → tuple[User, None]`

Calls Django's `authenticate()` with the extracted username and password. Raises `AuthenticationFailed` if user is None or inactive. Returns `(user, None)` — no auth token for Basic auth.

### `authenticate_header(request) → str`

Returns `'Basic realm="api"'`. Realm is configurable via `www_authenticate_realm`.

## SessionAuthentication

Uses Django's session framework. Only authenticates if a session-based user exists AND is active.

### `authenticate(request) → tuple[User, None] | None`

Gets user from `request._request.user` (Django's session middleware). Returns None if no user or inactive. If authenticated, calls `enforce_csrf()`.

### `enforce_csrf(request) → None | raises`

Runs Django's `CsrfViewMiddleware` check. Raises `PermissionDenied` (not `AuthenticationFailed`) with the CSRF failure reason on failure.

## TokenAuthentication

Token-based authentication (`Authorization: Token <key>`).

### `authenticate(request) → tuple[User, Token] | None`

Parses the `Authorization` header for the keyword (default: "Token"). Raises `AuthenticationFailed` for malformed headers or invalid tokens.

### `authenticate_credentials(key) → tuple[User, Token]`

Looks up token via `model.objects.select_related('user').get(key=key)`. Raises `AuthenticationFailed` if token not found or user inactive. Returns `(token.user, token)`.

### `get_model() → Model`

Returns `self.model` if set, otherwise lazy-imports `rest_framework.authtoken.models.Token`. This allows custom token models.

### `authenticate_header(request) → str`

Returns the keyword string (default: `"Token"`).

## RemoteUserAuthentication

Delegates to web server authentication via `REMOTE_USER` header.

### `authenticate(request) → tuple[User, None] | None`

Reads `request.META[self.header]` (default: "REMOTE_USER"), calls Django's `authenticate()` with `remote_user`. Returns `(user, None)` if user exists and is active, else None.

## Module-Level Utilities

### `get_authorization_header(request) → bytes`

Extracts `HTTP_AUTHORIZATION` from `request.META`. Encodes to bytes if string (workaround for Django test client).

### `CSRFCheck`

Subclass of `CsrfViewMiddleware` that returns the failure reason string from `_reject()` instead of an HttpResponse. Used by `SessionAuthentication.enforce_csrf()`.

## Failure Modes

| Scenario | Exception | Notes |
|---|---|---|
| Malformed Basic header | `AuthenticationFailed` | "No credentials provided" or "not correctly base64 encoded" |
| Invalid Basic credentials | `AuthenticationFailed` | "Invalid username/password" |
| Inactive user (Basic) | `AuthenticationFailed` | "User inactive or deleted" |
| CSRF failure (Session) | `PermissionDenied` | NOT AuthenticationFailed |
| Invalid token | `AuthenticationFailed` | "Invalid token" |
| Inactive user (Token) | `AuthenticationFailed` | "User inactive or deleted" |
| Malformed token header | `AuthenticationFailed` | Various messages |
