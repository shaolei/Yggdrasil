# Expert Patch: Commit 2 — Add `__eq__` method for OperandHolder

```yaml
pr: 0cb69370
type: feature
required_updates:
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Add __eq__ method to OperandHolder interface documentation. OperandHolder now supports equality comparison based on operator_class, op1_class, and op2_class."
    source: "Diff in permissions.py lines 46-54"
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Document the __eq__ implementation: two OperandHolders are equal iff they share the same operator_class, op1_class, and op2_class."
    source: "Diff in permissions.py"
decisions_in_pr:
  # No decisions in PR — minimal description
no_update_needed: []
```
