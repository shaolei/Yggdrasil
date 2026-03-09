# Authentication — Internals

## Logic

### Authentication Protocol
Each authenticator follows the same protocol:
1. Check if the request contains credentials for this scheme (e.g., `Authorization: Basic ...`).
2. If no matching credentials, return `None` (pass to next authenticator).
3. If credentials found but invalid, raise `AuthenticationFailed`.
4. If credentials valid, return `(user, auth_info)`.

### CSRFCheck Subclass
`CSRFCheck` overrides `CsrfViewMiddleware._reject()` to return the failure reason string instead of an `HttpResponse`. This allows `enforce_csrf()` to raise a `PermissionDenied` with the specific CSRF failure reason.

Commit `81fa4b4f` (#6113): Fixed CSRF cookie check failure with Django 1.11.6+ by calling `check.process_request(request)` before `check.process_view()` to populate `request.META['CSRF_COOKIE']`.

## Decisions

- **OAuth removed to separate package**: Commit `baa518cd` (#1767): "Moved OAuth support out of DRF and into a separate package." Multiple earlier commits show OAuth1 and OAuth2 implementations existed in this file before being extracted.
- **SessionAuthentication skips CSRF for unauthenticated**: If `user` is None or `not user.is_active`, returns `None` without checking CSRF. Rationale: unknown — inferred from code, but logically there is nothing to protect if the user is not authenticated via session.
- **BasicAuthentication UTF-8/Latin-1 fallback**: Commit `d7b218f5` (#7193): "decode base64 credentials as utf8; adjust tests." Added Latin-1 fallback via `UnicodeDecodeError` catch. Rationale: unknown — likely for compatibility with clients that send non-UTF-8 usernames/passwords.
- **TokenAuthentication lazy model import**: Commit `ff29fdd8`: "don't import authtoken model until needed." Prevents import errors when authtoken app is not installed.
- **TokenAuthentication customizable keyword**: Commit `ffdac0d9` (#4097): "Allow custom keyword in the header." Enables `Authorization: Bearer <token>` style.
