# API Request Lifecycle

## Business context

When a client makes an HTTP request to an API endpoint, the system must parse the request, identify the caller, verify they have permission, enforce rate limits, execute the business logic, and return a properly formatted response. This flow describes the full request processing pipeline.

## Trigger

An HTTP request arrives at a URL routed to an `APIView` subclass.

## Goal

Process the request through a pipeline of configurable policies (authentication, permissions, throttling) before dispatching to the handler method, and produce a properly rendered response.

## Participants

- **APIView (views.py)**: Orchestrator — owns the dispatch loop, initializes the request, runs the policy pipeline, handles exceptions, finalizes the response.
- **Request (request.py)**: Enhanced request wrapper — provides lazy access to parsed data, authenticated user, and proxies to Django's HttpRequest.
- **Authentication (authentication.py)**: Identity resolution — authenticator classes try to identify the user from request credentials.
- **Permissions (permissions.py)**: Access control — permission classes decide whether the identified user may perform the requested action.
- **Throttling (throttling.py)**: Rate limiting — throttle classes enforce request rate limits per user or IP.

## Paths

### Happy path

1. Django routes the request to `APIView.dispatch()`.
2. `dispatch()` calls `initialize_request()` which wraps the Django HttpRequest in a DRF `Request`, attaching parsers, authenticators, and content negotiator.
3. `dispatch()` calls `initial()` which runs the policy pipeline in order:
   a. Content negotiation — selects renderer and media type.
   b. API versioning — determines version from request.
   c. Authentication — `perform_authentication()` accesses `request.user`, triggering lazy auth via `Request._authenticate()`. Each authenticator is tried in order; first non-None result wins.
   d. Permission checking — `check_permissions()` iterates permission classes; all must pass.
   e. Throttle checking — `check_throttles()` iterates throttle classes; if any deny, the longest wait time is used.
4. The appropriate handler method (get, post, etc.) is called.
5. `finalize_response()` attaches renderer info and headers to the response.

### Authentication failure path

1. An authenticator raises `AuthenticationFailed` → `handle_exception()` catches it.
2. If an `authenticate_header` is available from the first authenticator, a 401 with WWW-Authenticate header is returned.
3. If no authenticate_header, the status is coerced to 403 Forbidden.

### Permission failure path

1. A permission class returns False → `permission_denied()` is called.
2. If authenticators exist but none succeeded (`request.successful_authenticator` is None), a `NotAuthenticated` (401) is raised instead of `PermissionDenied` (403). This distinguishes "not logged in" from "logged in but not allowed."

### Throttle failure path

1. A throttle class returns False → its `wait()` value is collected.
2. All throttles are checked (not short-circuited). The maximum wait time is used.
3. `Throttled` exception is raised with the wait time.
4. The response includes a `Retry-After` header.

### Unhandled exception path

1. If `handle_exception()` gets a response from the exception handler, it returns it.
2. If the exception handler returns None, the exception is re-raised (500).
3. In DEBUG mode, `raise_uncaught_exception` forces plaintext errors for non-HTML renderers.

## Invariants across all paths

- The order authentication → permissions → throttling is always maintained.
- Exception handling always calls `set_rollback()` to mark atomic transactions for rollback.
- All DRF views are CSRF-exempt at the Django level; CSRF enforcement is handled internally by SessionAuthentication.
- The response always passes through `finalize_response()` which applies Vary headers and renderer context.
