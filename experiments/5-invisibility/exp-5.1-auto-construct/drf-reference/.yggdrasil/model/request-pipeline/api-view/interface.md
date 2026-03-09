# APIView — Interface

## Class Attributes (Policy Configuration)

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `renderer_classes` | list[class] | `DEFAULT_RENDERER_CLASSES` | Response renderers |
| `parser_classes` | list[class] | `DEFAULT_PARSER_CLASSES` | Request body parsers |
| `authentication_classes` | list[class] | `DEFAULT_AUTHENTICATION_CLASSES` | Authenticator classes |
| `throttle_classes` | list[class] | `DEFAULT_THROTTLE_CLASSES` | Throttle classes |
| `permission_classes` | list[class] | `DEFAULT_PERMISSION_CLASSES` | Permission classes |
| `content_negotiation_class` | class | `DEFAULT_CONTENT_NEGOTIATION_CLASS` | Content negotiator |
| `versioning_class` | class | `DEFAULT_VERSIONING_CLASS` | API versioning scheme |
| `metadata_class` | class | `DEFAULT_METADATA_CLASS` | OPTIONS response metadata |
| `schema` | object | `DefaultSchema()` | Schema introspection |
| `settings` | object | `api_settings` | DRF settings (injectable for testing) |

## Class Methods

### `as_view(**initkwargs) → callable`

Creates the view function. Stores `cls` and `initkwargs` on the returned function. Wraps in `csrf_exempt`. On Django ≥5.1, sets `login_required = False` to exempt from `LoginRequiredMiddleware`. Guards against direct evaluation of `queryset` attribute (replaces `_fetch_all` with a RuntimeError).

## Instance Methods — Lifecycle

### `dispatch(request, *args, **kwargs) → Response`

Main entry point called by Django's URL routing. Sequence:
1. `initialize_request()` — wraps HttpRequest
2. `initial()` — content negotiation, authentication, permissions, throttling
3. Handler method resolution (maps HTTP method → `self.get`, `self.post`, etc.)
4. `finalize_response()` — attaches renderer context
5. On exception: `handle_exception()`

### `initialize_request(request, *args, **kwargs) → Request`

Creates a DRF `Request` wrapping the Django `HttpRequest`. Attaches parsers, authenticators, and content negotiator.

### `initial(request, *args, **kwargs) → None`

Pre-handler checks in fixed order:
1. Content negotiation
2. API version determination
3. `perform_authentication(request)` — forces `request.user` access
4. `check_permissions(request)` — iterates permission instances
5. `check_throttles(request)` — iterates throttle instances

### `finalize_response(request, response, *args, **kwargs) → Response`

Attaches `accepted_renderer`, `accepted_media_type`, and `renderer_context` to the Response. Merges Vary headers additively (does not overwrite).

### `handle_exception(exc) → Response`

Handles `NotAuthenticated`/`AuthenticationFailed`: if an authenticator provides `authenticate_header()`, sets `WWW-Authenticate` header and returns 401. Otherwise coerces to 403. Delegates to the configured `EXCEPTION_HANDLER`. If handler returns None, re-raises.

## Instance Methods — Policy Instantiation

### `get_authenticators() → list[BaseAuthentication]`
### `get_permissions() → list[BasePermission]`
### `get_throttles() → list[BaseThrottle]`
### `get_renderers() → list[BaseRenderer]`
### `get_parsers() → list[BaseParser]`

Each instantiates its respective `*_classes` attribute. Override to customize per-request.

## Instance Methods — Policy Checks

### `perform_authentication(request) → None`

Accesses `request.user` to force lazy authentication. Can be overridden to `pass` for lazy-only auth.

### `check_permissions(request) → None`

Iterates `get_permissions()`, calls `has_permission(request, self)`. On failure, calls `permission_denied()`.

### `check_object_permissions(request, obj) → None`

Iterates `get_permissions()`, calls `has_object_permission(request, self, obj)`. Must be called explicitly by the handler (not called automatically).

### `check_throttles(request) → None`

Iterates `get_throttles()`, calls `allow_request(request, self)`. Collects `wait()` from all failing throttles, takes the maximum, calls `throttled()`.

### `permission_denied(request, message=None, code=None) → raises`

If authenticators exist but none succeeded, raises `NotAuthenticated` (401). Otherwise raises `PermissionDenied` (403).

### `throttled(request, wait) → raises`

Raises `Throttled(wait)`.

## Failure Modes

| Scenario | Exception | HTTP Status |
|---|---|---|
| No matching handler method | `MethodNotAllowed` | 405 |
| Authentication failed | `AuthenticationFailed` | 401 (with auth header) or 403 |
| Not authenticated | `NotAuthenticated` | 401 (with auth header) or 403 |
| Permission denied | `PermissionDenied` | 403 |
| Rate limited | `Throttled` | 429 |
| Unhandled exception | Re-raised | 500 |
| Handler returns non-Response | `AssertionError` | crash |

## Module-Level Functions

### `exception_handler(exc, context) → Response | None`

Default exception handler. Handles `APIException`, Django's `Http404`, and `PermissionDenied`. Calls `set_rollback()` on atomic database connections. Returns None for unrecognized exceptions.

### `set_rollback() → None`

Marks rollback on all database connections where `ATOMIC_REQUESTS` is True and a transaction is active.

### `get_view_name(view) → str`

Derives a human-readable view name from the class name (strips "View"/"ViewSet" suffix, converts camelCase to spaces, appends suffix attribute if present).

### `get_view_description(view, html=False) → str`

Returns the view's docstring, dedented. Optionally rendered as HTML.
