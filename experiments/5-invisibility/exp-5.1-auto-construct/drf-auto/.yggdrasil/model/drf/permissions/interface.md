# Permissions — Interface

## Constants

- `SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')` — read-only HTTP methods

## Base Class

### `BasePermission`
Uses `BasePermissionMetaclass` which mixes in `OperationHolderMixin` for operator support.

#### `has_permission(request, view) -> bool`
View-level permission check. Default returns `True`.

#### `has_object_permission(request, view, obj) -> bool`
Object-level permission check. Default returns `True`. Only called if `view.check_object_permissions()` is explicitly invoked by the view.

## Built-in Permission Classes

### `AllowAny`
Always returns True. Comment: "This isn't strictly required, since you could use an empty permission_classes list, but it's useful because it makes the intention more explicit."

### `IsAuthenticated`
Checks `request.user and request.user.is_authenticated`.

### `IsAdminUser`
Checks `request.user and request.user.is_staff`.

### `IsAuthenticatedOrReadOnly`
Allows read-only access to unauthenticated users; requires authentication for write methods.

### `DjangoModelPermissions`
Maps HTTP methods to Django's `add`/`change`/`delete` model permissions via `perms_map`. Requires view to have `queryset` or `get_queryset()`.
- `authenticated_users_only = True` — rejects unauthenticated before checking model perms.
- Workaround for DefaultRouter root view: skips check if `_ignore_model_permissions` is set.

### `DjangoModelPermissionsOrAnonReadOnly`
Same as `DjangoModelPermissions` but `authenticated_users_only = False`.

### `DjangoObjectPermissions`
Extends `DjangoModelPermissions` with object-level checks via `user.has_perms(perms, obj)`.
- If user lacks object permissions on a write method: checks read permissions. If no read permissions either, raises `Http404` (hides resource existence). If has read but not write permissions, returns `False` (403).

## Composition Operators

- `PermA & PermB` → `AND(op1, op2)` — both must pass
- `PermA | PermB` → `OR(op1, op2)` — either must pass (with correct object permission semantics)
- `~PermA` → `NOT(op1)` — inverted

`OperandHolder` implements `__eq__` and `__hash__` for use in collections.

## Failure Modes

- View without `queryset` or `get_queryset()` using `DjangoModelPermissions` → `AssertionError`
- `get_queryset()` returns `None` → `AssertionError` with class name in message
- HTTP method not in `perms_map` → `MethodNotAllowed`
