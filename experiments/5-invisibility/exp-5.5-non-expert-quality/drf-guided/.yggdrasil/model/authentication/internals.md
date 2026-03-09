# Authentication — Internals

## Logic

### Multi-Authenticator Resolution
Authenticators are tried in order. `None` return = "not my scheme, try next." Tuple return = success, stop. Exception = fail immediately, no further attempts.

### SessionAuthentication CSRF
SessionAuthentication enforces CSRF itself via `CSRFCheck` (a subclass of Django's `CsrfViewMiddleware` that returns the reason string instead of an HttpResponse). This is because all DRF views are `csrf_exempt` — CSRF is only enforced for session-based auth, not token-based.

### BasicAuthentication Encoding
Tries UTF-8 first, falls back to Latin-1 for credential decoding. Handles the case where credentials contain non-ASCII characters.

## Decisions

- **CSRF split between view and auth**: Chose to csrf_exempt all views in `as_view()` and re-enforce CSRF only in SessionAuthentication. Alternative: per-auth-class CSRF configuration. Chose current approach because token-based auth should never require CSRF, and session auth always should. Rationale: simplicity — only one auth class needs CSRF.

- **SessionAuthentication returns 403, not 401**: SessionAuthentication does not define `authenticate_header()`, so auth failures produce 403. Chose this over 401 because browsers show a native auth dialog on 401, which is wrong for session/cookie-based auth. Rationale: browser compatibility.
