# APIView — Internals

## Logic

### Dispatch sequence

`dispatch()` is the central orchestrator. It:
1. Stores `args` and `kwargs` on `self` for access by other methods.
2. Calls `initialize_request()` to wrap the raw Django HttpRequest.
3. Sets `self.request` and `self.headers` (default response headers).
4. Calls `initial()` inside a try/except that catches ALL exceptions.
5. Resolves the handler: `getattr(self, request.method.lower(), self.http_method_not_allowed)`.
6. Calls the handler.
7. On exception, calls `handle_exception()`.
8. Calls `finalize_response()` on the result and stores it in `self.response`.

### Exception → HTTP status mapping

`handle_exception()` has special logic for authentication errors:
- If the exception is `NotAuthenticated` or `AuthenticationFailed`, it checks whether any authenticator provides a `WWW-Authenticate` header via `get_authenticate_header()`.
- If a header is available: sets `exc.auth_header` and keeps the 401 status.
- If NO header is available: coerces `exc.status_code` to 403. This is because a 401 response without a `WWW-Authenticate` header violates HTTP spec (RFC 7235).

### Content negotiation forced fallback

`finalize_response()` handles the case where `initial()` was never reached (exception during authentication). If `request.accepted_renderer` is not set, it calls `perform_content_negotiation(request, force=True)`, which catches negotiation failures and falls back to the first renderer.

### CSRF exemption strategy

All DRF views are `csrf_exempt` at the Django level. This is applied in `as_view()`, NOT in `dispatch()`. The comment in the code explains: "Views are made CSRF exempt from within `as_view` as to prevent accidental removal of this exemption in cases where `dispatch` needs to be overridden." CSRF enforcement for session-based auth is handled by `SessionAuthentication.enforce_csrf()`.

### QuerySet safety guard

`as_view()` checks whether `cls.queryset` is a `QuerySet` instance. If so, it replaces `_fetch_all` with a function that raises `RuntimeError`, preventing accidental evaluation and caching of the queryset between requests.

## Decisions

### CSRF exempt at as_view() not dispatch() — rationale: observable from code comment

Chose to apply `csrf_exempt` in `as_view()` over applying it in `dispatch()` because overriding `dispatch()` in subclasses could accidentally remove the exemption.

### 401→403 coercion when no auth header — rationale: inferred from HTTP spec

Chose to coerce 401 to 403 when no authenticator provides a `WWW-Authenticate` header, over always returning 401, because RFC 7235 requires 401 responses to include a `WWW-Authenticate` header.

### Permission denied distinguishes "not logged in" from "not allowed" — rationale: inferred from code

`permission_denied()` checks whether authenticators exist but none succeeded. If so, raises `NotAuthenticated` (401) instead of `PermissionDenied` (403). This gives the client a meaningful signal: "try authenticating" vs "you authenticated but lack permissions."

### check_object_permissions not called automatically — rationale: unknown — inferred from code

`check_object_permissions()` is a separate method that must be called explicitly in the handler (typically via `get_object()`). It is NOT called during `initial()`. This means view-level permissions and object-level permissions are checked at different points in the lifecycle.

### Django ≥5.1 LoginRequiredMiddleware exemption — rationale: observable from code comment

Sets `view.login_required = False` to exempt DRF views from Django 5.1's `LoginRequiredMiddleware`. The comment says users should use `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` instead, keeping auth control within DRF's system.
