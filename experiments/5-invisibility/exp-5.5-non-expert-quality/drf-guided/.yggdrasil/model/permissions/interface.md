# Permissions — Interface

## BasePermission

### has_permission(request, view) → bool
Check view-level permission. Default: `True`. Called by APIView.check_permissions for every request.

### has_object_permission(request, view, obj) → bool
Check object-level permission. Default: `True`. Called by APIView.check_object_permissions (must be invoked explicitly by view code).

## Composition Operators

Permissions support `&` (AND), `|` (OR), `~` (NOT) via `OperationHolderMixin` and metaclass.

### OR Composition — has_object_permission
The OR operator's `has_object_permission` re-evaluates `has_permission` for each operand: `(A.has_permission AND A.has_object_permission) OR (B.has_permission AND B.has_object_permission)`. This ensures object permissions only apply through the branch that granted view-level access.

## Built-in Classes

- **AllowAny** — always returns True
- **IsAuthenticated** — `request.user and request.user.is_authenticated`
- **IsAdminUser** — `request.user and request.user.is_staff`
- **IsAuthenticatedOrReadOnly** — authenticated or SAFE_METHODS (GET, HEAD, OPTIONS)
- **DjangoModelPermissions** — maps HTTP methods to Django model permissions (add/change/delete). Requires `queryset` on view.
- **DjangoObjectPermissions** — extends DjangoModelPermissions with object-level checks. Returns 404 instead of 403 when user lacks read permission (prevents information leakage).

## Constants
- `SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')`

## Failure Modes
- Permission denial results in `PermissionDenied` or `NotAuthenticated` exception (raised by APIView, not by permission classes themselves)
- `DjangoModelPermissions` raises `MethodNotAllowed` for HTTP methods not in `perms_map`
