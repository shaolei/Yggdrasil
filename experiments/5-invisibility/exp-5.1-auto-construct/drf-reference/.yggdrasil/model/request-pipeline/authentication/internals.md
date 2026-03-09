# Authentication — Internals

## Logic

### Three-outcome protocol

Every authenticator has three possible outcomes:
1. **Return (user, auth)** — credentials found and valid. Stops the chain.
2. **Return None** — this authenticator doesn't apply (e.g., wrong header scheme). Chain continues.
3. **Raise AuthenticationFailed** — credentials found but invalid. Chain stops with error.

This three-outcome pattern allows multiple authenticators to coexist: each checks if the request matches its scheme before attempting validation.

### CSRF enforcement scope

Only `SessionAuthentication` enforces CSRF. All other authenticators are CSRF-exempt. This is deliberate: session cookies are automatically sent by browsers (ambient credentials), making CSRF attacks possible. Token/Basic credentials must be explicitly attached by the client, so CSRF is not a threat.

The CSRF check uses a private subclass `CSRFCheck(CsrfViewMiddleware)` that overrides `_reject()` to return the reason string instead of an HttpResponse. This allows `enforce_csrf()` to raise a `PermissionDenied` with the specific CSRF failure reason.

### CSRF failure as PermissionDenied not AuthenticationFailed

`SessionAuthentication.enforce_csrf()` raises `PermissionDenied`, not `AuthenticationFailed`. Rationale: unknown — inferred from code. The user IS authenticated (session is valid); the problem is the request itself lacks CSRF protection. This may be intentional to avoid triggering 401 responses and `WWW-Authenticate` headers for what is essentially a request forgery protection issue.

### Basic auth encoding fallback

`BasicAuthentication` decodes base64 credentials as UTF-8 first, then falls back to Latin-1 on `UnicodeDecodeError`. Rationale: unknown — inferred from code. Likely for backward compatibility with clients that send non-UTF-8 credentials.

### Token model lazy import

`TokenAuthentication.get_model()` lazy-imports `rest_framework.authtoken.models.Token` only when needed. This avoids requiring the `authtoken` app to be installed unless `TokenAuthentication` is actually used. The `model` class attribute allows swapping in a custom token model.

### select_related optimization

`TokenAuthentication.authenticate_credentials()` uses `select_related('user')` when fetching the token to avoid a separate query for the user object.

## Decisions

### Session auth reads from _request.user not request.user — rationale: inferred from code

`SessionAuthentication.authenticate()` reads `request._request.user` (the underlying Django HttpRequest) instead of `request.user`. This avoids infinite recursion: `request.user` triggers `_authenticate()`, which calls the authenticator, which would call `request.user` again.

### Only first authenticator's header used for WWW-Authenticate — rationale: inferred from code

`APIView.get_authenticate_header()` returns `authenticators[0].authenticate_header(request)`. Only the first authenticator's header is used, regardless of how many are configured. Rationale: unknown — possibly because HTTP spec allows only one scheme per `WWW-Authenticate` header per challenge, and choosing the first keeps behavior predictable.
