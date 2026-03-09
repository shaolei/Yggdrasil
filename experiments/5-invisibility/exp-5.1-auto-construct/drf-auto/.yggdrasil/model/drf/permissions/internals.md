# Permissions — Internals

## Logic

### OR Object Permission Semantics
The `OR` class's `has_object_permission` checks: `(op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission)`. This was changed in commit `4aea8dd6` (#7522): "The original semantic of OR is defined as: the request pass either of the two has_permission() checks. But when checking object permissions, the original implementation only checks has_object_permission without verifying has_permission first." The new semantic ensures a permission that fails `has_permission` cannot bypass via `has_object_permission`.

### DjangoObjectPermissions 404 vs 403 Logic
When a user lacks object permissions:
1. If it's a safe method (GET/HEAD/OPTIONS) — raise `Http404` (already checked read perms and failed).
2. If it's a write method — check if user has GET permissions on the object. If not, raise `Http404` (hide resource). If yes, return `False` (403 — user can see it exists but can't modify it).

This prevents information leakage: unauthorized users cannot distinguish "resource doesn't exist" from "resource exists but you can't access it."

### Rejection of anonymous before queryset access
Commit `c8773671`: "Rejecting anonymous in DjangoModelPermissions *before* the .get_queryset call." This prevents unnecessary database queries when the user is clearly not going to pass permission checks.

## Decisions

- **Composition via metaclass**: `BasePermissionMetaclass` inherits from both `OperationHolderMixin` and `type`, giving all `BasePermission` subclasses the `__and__`, `__or__`, `__invert__` operators at the class level (not instance level). This allows `IsAuthenticated & IsAdminUser` syntax on classes, not instances.
- **`_ignore_model_permissions` workaround**: Comment: "Workaround to ensure DjangoModelPermissions are not applied to the root view when using DefaultRouter." Rationale: unknown — the root view of DefaultRouter lists available endpoints and has no model.
- **AllowAny exists despite being equivalent to empty permission_classes**: Code comment explains it "makes the intention more explicit."
