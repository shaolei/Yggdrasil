# APIView — Internals

## Logic

### Dispatch Flow
`dispatch()` → `initialize_request()` → `initial()` → handler → `finalize_response()`

All exceptions caught in `dispatch()` and routed to `handle_exception()`.

### 401 vs 403 Coercion
In `handle_exception()`, `NotAuthenticated` and `AuthenticationFailed` exceptions check `get_authenticate_header()`. If a WWW-Authenticate value exists (e.g., `Basic realm="api"` or `Token`), the response is 401 with that header. If not (e.g., SessionAuthentication), the status is coerced to 403. This prevents browsers from showing their native auth dialog for session-based auth.

### CSRF Handling
`csrf_exempt` is applied in `as_view()` rather than on `dispatch()` to prevent accidental removal when dispatch is overridden. SessionAuthentication then re-enforces CSRF itself.

### Queryset Evaluation Guard
`as_view()` replaces `queryset._fetch_all` with a function that raises RuntimeError if the queryset is evaluated directly on the class (it would be cached between requests).

## Constraints

- The order of checks in `initial()` (auth → permissions → throttles) is intentional and must not change. Permissions depend on `request.user` being set. Throttles come after permissions to avoid wasting throttle budget on denied requests.
- Content negotiation must happen before security checks because error responses need to know the response format.

## Decisions

- **Throttle collection vs short-circuit**: Chose to collect all throttle failures and report max wait time, rather than short-circuiting on first throttle failure. This gives the client the most accurate retry information. Permissions short-circuit because there is no useful "combined" denial message.

- **set_rollback() on handled exceptions**: When ATOMIC_REQUESTS is enabled and an exception is caught by the handler, `set_rollback(True)` is called on all connections in atomic blocks. Without this, Django would commit the transaction (because no unhandled exception escaped), but data may be in an inconsistent state. Chose explicit rollback over letting Django commit. Rationale: data safety over performance.
