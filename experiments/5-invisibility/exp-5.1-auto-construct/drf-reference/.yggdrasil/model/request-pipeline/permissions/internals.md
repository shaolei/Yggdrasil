# Permissions — Internals

## Logic

### Two-level permission model

Permissions operate at two levels:
1. **View-level** (`has_permission`) — checked automatically during `initial()`. Answers: "Can this user use this endpoint at all?"
2. **Object-level** (`has_object_permission`) — checked explicitly via `check_object_permissions()`. Answers: "Can this user act on this specific object?"

Object-level checks are NOT automatic. The view must call `self.check_object_permissions(request, obj)`, typically inside `get_object()`. This is a conscious design choice (see Decisions).

### OR operator's object permission logic

`OR.has_object_permission` does NOT simply `or` the two object permission results. Instead it checks:
```
(op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission)
```

This is because object permissions are only meaningful if the corresponding view-level permission also passes. Without this, `IsAuthenticated | IsProjectMember` with object permissions would behave incorrectly: `IsAuthenticated.has_object_permission()` always returns True (default), which would grant access even if the user isn't a project member.

### DjangoObjectPermissions 404 masking

When `has_object_permission` fails, the code checks if the user has read permissions for the object. If not, it raises `Http404` instead of returning False (which would become 403). This prevents information leakage: an unauthorized user cannot determine whether an object exists by distinguishing 403 from 404.

### Metaclass-based operator support

`BasePermission` uses `BasePermissionMetaclass`, which inherits from both `OperationHolderMixin` and `type`. This means the operators (`&`, `|`, `~`) work on the CLASS itself, not just instances. `IsAuthenticated & IsAdminUser` composes two classes, not two instances.

### DefaultRouter workaround

`DjangoModelPermissions.has_permission()` checks for `view._ignore_model_permissions`. This is a workaround for `DefaultRouter`'s root view, which doesn't have a queryset.

## Decisions

### Object permissions not checked automatically — rationale: unknown — inferred from code

Chose to require explicit `check_object_permissions()` calls over automatic checking in `initial()`. This may be because the object isn't available during `initial()` — it's fetched in the handler. But it also means developers can forget to call it, silently skipping object-level checks.

### 404 masking for unauthorized objects — rationale: inferred from code

`DjangoObjectPermissions` returns 404 instead of 403 when the user lacks read permissions on an object. This is a security pattern to prevent enumeration attacks — an attacker cannot distinguish "object doesn't exist" from "object exists but I can't access it."

### Separate SAFE_METHODS constant — rationale: inferred from code

`SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')` is defined as a module-level constant rather than inline. This allows permissions to import and reference it consistently, and allows users to reference it in custom permissions.

### AllowAny exists despite being a no-op — rationale: observable from code comment

The code comment says: "This isn't strictly required, since you could use an empty permission_classes list, but it's useful because it makes the intention more explicit." Chose an explicit class over relying on empty list for readability and intent signaling.
