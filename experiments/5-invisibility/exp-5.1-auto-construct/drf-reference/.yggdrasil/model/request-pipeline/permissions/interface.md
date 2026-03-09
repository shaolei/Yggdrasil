# Permissions — Interface

## BasePermission

### `has_permission(request, view) → bool`

View-level permission check. Called by `APIView.check_permissions()` before the handler. Default returns True (allow all).

### `has_object_permission(request, view, obj) → bool`

Object-level permission check. Called by `APIView.check_object_permissions(request, obj)` — must be called explicitly in the handler. Default returns True. Only called if `has_permission()` passed.

### Class Attributes

- `message` — optional custom error message used by APIView when permission denied
- `code` — optional custom error code used by APIView when permission denied

## Built-in Permission Classes

### `AllowAny`

Always returns True. Exists for explicit intent — equivalent to an empty `permission_classes` list.

### `IsAuthenticated`

`has_permission`: returns `bool(request.user and request.user.is_authenticated)`.

### `IsAdminUser`

`has_permission`: returns `bool(request.user and request.user.is_staff)`.

### `IsAuthenticatedOrReadOnly`

`has_permission`: returns True if `request.method in SAFE_METHODS` OR user is authenticated.

### `DjangoModelPermissions`

Maps HTTP methods to Django permission codes via `perms_map`:
- GET, HEAD, OPTIONS → no permissions required
- POST → `add` permission
- PUT, PATCH → `change` permission
- DELETE → `delete` permission

Requires a view with `queryset` or `get_queryset()`. Checks `request.user.has_perms()`.

`authenticated_users_only = True` — rejects unauthenticated users.

### `DjangoModelPermissionsOrAnonReadOnly`

Same as `DjangoModelPermissions` with `authenticated_users_only = False`.

### `DjangoObjectPermissions`

Extends `DjangoModelPermissions` with object-level checks. Uses `has_perms(perms, obj)`.

`has_object_permission`: On permission failure, checks whether the user lacks read permissions too. If so, raises `Http404` (hiding the object's existence). If user has read but not write permissions, returns False (which becomes 403).

## Operator Composition

### `BasePermission & BasePermission → OperandHolder(AND, ...)`
### `BasePermission | BasePermission → OperandHolder(OR, ...)`
### `~BasePermission → SingleOperandHolder(NOT, ...)`

Operators are available on the classes themselves (via `BasePermissionMetaclass`) and on composed results (via `OperationHolderMixin`). Composed objects are callable — they act as class factories.

## Constants

### `SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')`

## Failure Modes

| Scenario | Result | Notes |
|---|---|---|
| `has_permission` returns False | `PermissionDenied` or `NotAuthenticated` (via APIView) | APIView decides which |
| `has_object_permission` returns False | Same as above | |
| `DjangoObjectPermissions` no read access | `Http404` | Hides object existence |
| View has no queryset (DjangoModelPermissions) | `AssertionError` | |
| Unknown HTTP method (DjangoModelPermissions) | `MethodNotAllowed` | |
