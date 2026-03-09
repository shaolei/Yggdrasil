# APIView — Interface

## Class Attributes (Policy Configuration)

- `renderer_classes` — list of renderer classes (default from settings)
- `parser_classes` — list of parser classes (default from settings)
- `authentication_classes` — list of authenticator classes (default from settings)
- `throttle_classes` — list of throttle classes (default from settings)
- `permission_classes` — list of permission classes (default from settings)
- `content_negotiation_class` — content negotiation class (default from settings)
- `metadata_class` — metadata class for OPTIONS (default from settings)
- `versioning_class` — versioning class (default from settings)
- `settings` — DRF settings object, injectable for testing
- `schema` — schema instance (default `DefaultSchema()`)

## Class Methods

### `as_view(**initkwargs) -> view_function`
Wraps Django's `View.as_view()`. Stores `cls` and `initkwargs` on the view function. Applies `csrf_exempt`. Guards against direct `.queryset` evaluation on the class. Sets `login_required = False` for Django 5.1+.

## Instance Methods — Dispatch

### `dispatch(request, *args, **kwargs) -> Response`
Main entry point. Calls `initialize_request` → `initial` → handler → `finalize_response`. Catches all exceptions via `handle_exception`.

### `initialize_request(request, *args, **kwargs) -> Request`
Wraps Django's HttpRequest in a DRF `Request` with parsers, authenticators, and negotiator.

### `initial(request, *args, **kwargs) -> None`
Runs pre-handler pipeline: content negotiation, versioning, authentication, permissions, throttles.

### `finalize_response(request, response, *args, **kwargs) -> Response`
Attaches renderer, media type, and renderer context to Response. Patches Vary headers.

### `handle_exception(exc) -> Response`
Routes exceptions through the configurable exception handler. Sets WWW-Authenticate header for 401s. Coerces auth failures without authenticate_header to 403.

## Instance Methods — Policy Checks

### `perform_authentication(request) -> None`
Forces eager authentication by accessing `request.user`.

### `check_permissions(request) -> None`
Iterates permission classes. Raises `PermissionDenied` or `NotAuthenticated` on failure.

### `check_object_permissions(request, obj) -> None`
Like `check_permissions` but calls `has_object_permission`.

### `check_throttles(request) -> None`
Iterates throttle classes. Collects wait times. Raises `Throttled` with max wait.

### `permission_denied(request, message=None, code=None) -> Never`
Raises `NotAuthenticated` if no successful authenticator, else `PermissionDenied`.

## Module-Level Functions

### `exception_handler(exc, context) -> Response | None`
Default handler. Converts Django's `Http404` and `PermissionDenied` to DRF exceptions. Returns `Response` for `APIException` subclasses, `None` for unhandled.

### `set_rollback() -> None`
Sets rollback flag on all database connections with `ATOMIC_REQUESTS` that are in an atomic block.

### `get_view_name(view) -> str`
Returns human-readable view name for browsable API. Strips "View"/"ViewSet" suffix, converts camelCase to spaces.

### `get_view_description(view, html=False) -> str`
Returns view description from `view.description` or docstring.

## Failure Modes

- Handler returns non-`HttpResponseBase` → `AssertionError`
- Unhandled exception in handler → re-raised after setting rollback (500 in production, debug page in DEBUG mode)
- Queryset evaluated directly on class → `RuntimeError` (guard in `as_view`)
