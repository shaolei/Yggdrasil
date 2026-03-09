# Boolean Operator Composition for Permissions

## What

Permission classes can be combined using Python's `&` (AND), `|` (OR), and `~` (NOT) operators. The expression `IsAuthenticated & IsAdminUser` produces a composite permission that requires both conditions. This is implemented through `OperationHolderMixin` on the `BasePermissionMetaclass`, `OperandHolder` (binary ops), and `SingleOperandHolder` (unary NOT).

## Why

Without composition, developers would need to create a new permission class for every combination of requirements. The operator approach allows declarative composition: `permission_classes = [IsAuthenticated & (IsAdminUser | IsProjectMember)]`.

## Rules

1. The composed objects are callable — they act as permission class factories that instantiate their operands and wrap them in AND/OR/NOT operator classes.
2. OR's `has_object_permission` is intentionally non-trivial: it re-checks `has_permission` for each operand before checking `has_object_permission`, because object permissions are only meaningful if the view-level permission also passes for that operand.
3. NOT applies to both `has_permission` and `has_object_permission`.
4. `OperandHolder` implements `__eq__` and `__hash__` for use in sets and comparisons.
