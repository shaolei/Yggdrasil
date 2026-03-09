# Auto Patch: Commit 1 — Change semantic of OR of two permission classes

```yaml
pr: 4aea8dd6
type: aspect-affecting
required_updates:
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Update OR composition logic: has_object_permission now re-checks has_permission per operand. Old: op1.has_object_permission OR op2.has_object_permission. New: (op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission)."
    source: "Diff in permissions.py lines 78-85"
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Update OR.has_object_permission contract to reflect that it now re-evaluates has_permission for each operand before checking has_object_permission."
    source: "Diff in permissions.py"
  - target: aspects/operator-composition/requirements.md
    operation: modify
    description: "Update aspect to note that OR composition couples has_permission and has_object_permission per branch."
    source: "Diff + commit message"
decisions_in_pr:
  - decision: "Chose coupled permission checks per OR branch over independent evaluation to prevent a request from passing OR when it would fail both individual classes on object permissions."
    source: "Commit message body"
    should_be_captured: true
```
