# APIView — Interface

## Key Methods

### dispatch(request, *args, **kwargs)
Entry point called by Django's URL routing. Wraps request, runs `initial()`, dispatches to handler, handles exceptions, finalizes response. Returns `HttpResponseBase`.

### initial(request, *args, **kwargs)
Pre-handler pipeline. Runs in fixed order:
1. Content negotiation (`perform_content_negotiation`)
2. Version determination (`determine_version`)
3. Authentication (`perform_authentication`) — forces eager auth by accessing `request.user`
4. Permission check (`check_permissions`) — iterates all permissions, short-circuits on first denial
5. Throttle check (`check_throttles`) — collects ALL throttle failures, raises with max wait

### check_permissions(request)
Iterates `get_permissions()`. Short-circuits: first permission returning `False` raises `PermissionDenied` or `NotAuthenticated` (if no authenticator succeeded).

### check_object_permissions(request, obj)
Must be called explicitly by view code. Same iteration as `check_permissions` but calls `has_object_permission(request, view, obj)`.

### check_throttles(request)
Iterates `get_throttles()`. Unlike permissions, does NOT short-circuit — collects all wait durations and raises `Throttled` with the maximum.

### handle_exception(exc)
Converts exceptions to responses. Special behavior: `NotAuthenticated`/`AuthenticationFailed` become 401 if `get_authenticate_header()` returns a value, otherwise coerced to 403.

### permission_denied(request, message=None, code=None)
Raises `NotAuthenticated` if authenticators exist but none succeeded; otherwise raises `PermissionDenied`.

## Policy Configuration (Class Attributes)
- `authentication_classes` — default from `DEFAULT_AUTHENTICATION_CLASSES`
- `permission_classes` — default from `DEFAULT_PERMISSION_CLASSES`
- `throttle_classes` — default from `DEFAULT_THROTTLE_CLASSES`
- `renderer_classes`, `parser_classes`, `content_negotiation_class`, `versioning_class`, `metadata_class`

## Failure Modes
- `MethodNotAllowed` (405) — HTTP method not in `http_method_names`
- `PermissionDenied` (403) or `NotAuthenticated` (401) — from permission/auth checks
- `Throttled` (429) — from throttle checks
- Unhandled exceptions re-raised as 500 after `set_rollback()` if ATOMIC_REQUESTS
