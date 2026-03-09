# API Request Processing

## Business context

When a client sends an HTTP request to a Django REST Framework API endpoint, the system must identify who the caller is, verify they are allowed to perform the requested action, enforce rate limits, and then execute the appropriate handler. This is the core pipeline that every API request passes through.

## Trigger

An HTTP request arrives at a URL routed to an APIView subclass.

## Goal

Execute the appropriate view handler only after the request has been authenticated, authorized, and rate-limit-checked, returning a properly formatted response or a structured error.

## Participants

- **APIView** — Orchestrates the pipeline: wraps the Django request, runs pre-handler checks, dispatches to the handler, handles exceptions, and finalizes the response.
- **Request** — Wraps the Django HttpRequest to provide lazy authentication, content parsing, and a richer API.
- **Authentication** — Identifies the user making the request by examining credentials (tokens, sessions, HTTP Basic).
- **Permissions** — Determines whether the identified user is allowed to perform the requested action on the requested resource.
- **Throttling** — Enforces rate limits to prevent abuse, using cache-backed sliding window counters.

## Paths

### Happy path

1. Django's URL router calls `APIView.dispatch()`.
2. `dispatch()` calls `initialize_request()`, which wraps the Django HttpRequest in a DRF `Request` object, attaching the view's configured authenticators, parsers, and content negotiator.
3. `dispatch()` calls `initial()`, which runs three checks in fixed order:
   a. `perform_authentication()` — forces `request.user` evaluation, which iterates authenticators until one returns a (user, auth) tuple or all return None (anonymous).
   b. `check_permissions()` — iterates permission classes, calling `has_permission(request, view)` on each.
   c. `check_throttles()` — iterates throttle classes, calling `allow_request(request, view)` on each.
4. `dispatch()` resolves the HTTP method to a handler method (e.g., `get`, `post`) and calls it.
5. The handler returns a `Response`.
6. `dispatch()` calls `finalize_response()`, which attaches renderer and content negotiation info.

### Authentication failure path

An authenticator raises `AuthenticationFailed`. `handle_exception()` checks for a `WWW-Authenticate` header; if present, returns 401 with the header. If no authenticator provides a header, the status is coerced to 403.

### Permission denied path

A permission's `has_permission()` returns False. `permission_denied()` checks whether any authenticators were configured and none succeeded — if so, raises `NotAuthenticated` (401) instead of `PermissionDenied` (403). This distinguishes "you didn't log in" from "you logged in but aren't allowed."

### Throttled path

A throttle's `allow_request()` returns False. The view collects `wait()` durations from all failing throttles, takes the maximum, and raises `Throttled` with a `Retry-After` header.

### Unhandled exception path

If the exception handler returns None (unrecognized exception type), the exception is re-raised. In DEBUG mode, the request is configured for plaintext error rendering if the accepted renderer is not HTML-based.

## Invariants across all paths

- Authentication always runs before permissions, and permissions always run before throttling.
- All DRF views are CSRF-exempt at the Django level; CSRF enforcement is handled selectively by `SessionAuthentication`.
- The `exception_handler` calls `set_rollback()` for all database connections with `ATOMIC_REQUESTS` enabled.
- Exception responses include `WWW-Authenticate` and `Retry-After` headers when applicable.
