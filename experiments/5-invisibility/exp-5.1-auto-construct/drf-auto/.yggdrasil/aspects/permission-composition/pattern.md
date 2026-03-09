# Permission Composition

## What

Permission classes support Python bitwise operators for composition:
- `PermA & PermB` — both must pass (AND)
- `PermA | PermB` — either must pass (OR)
- `~PermA` — inverted (NOT)

This is implemented via `OperationHolderMixin` on `BasePermissionMetaclass`, `OperandHolder` (binary), and `SingleOperandHolder` (unary). Composed permissions are lazy-evaluated.

## Why

From commit `b41a6cfa` (#5753): "Allow permissions to be composed." The negation operator was added later in commit `2daf6f13` (#6361).

The OR semantic for `has_object_permission` was changed in commit `4aea8dd6` (#7522) to require that the same operand passes BOTH `has_permission` AND `has_object_permission`. The original semantic only checked `has_object_permission` on each operand, which was incorrect because a permission that fails `has_permission` should not be considered as passing just because its `has_object_permission` returns True.

Lazy evaluation was added in commit `94fbfcb6` (#6463, refs #6402) so that composed permissions short-circuit correctly.

Commit `6f2c0dbf` noted: "`x and y` actually returns object y when both are true" — meaning permissions must return a boolean, not rely on Python's truthiness behavior.

## Constraints

- `OperandHolder` implements `__eq__` and `__hash__` for use in sets/dicts (added in commits `0cb69370` #8710 and `fe92f0dd` #9417).
- Composed permissions instantiate both operand classes when called, regardless of short-circuit evaluation.
