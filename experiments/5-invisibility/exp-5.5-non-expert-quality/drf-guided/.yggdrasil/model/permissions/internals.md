# Permissions — Internals

## Logic

### OR Object Permission Semantics
`OR.has_object_permission` checks `(op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission)`. This is intentionally different from a naive `op1.has_object_permission OR op2.has_object_permission`. Rationale: if permission A denied view-level access but permission B granted it, only B's object-level check should apply. Without the re-check, A's object permission could grant access despite A's view-level denial.

### DjangoObjectPermissions 404 vs 403
When object permission is denied: if the user also lacks read (GET) permission on the object, returns 404 instead of 403. This prevents leaking information about whether the object exists to unauthorized users.

## Decisions

- **Composition operators over custom classes**: Added AND/OR/NOT composition operators to avoid requiring users to write custom permission classes for combined logic. Alternative: only support list-of-permissions (implicit AND). Chose composition because OR logic was a common request.

- **Object permission 404 masking**: DjangoObjectPermissions returns 404 when user lacks read permission. Chose information hiding over honest 403. Rationale: security — preventing enumeration attacks.
