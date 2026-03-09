# Expert Patch: Commit 1 — Change semantic of OR of two permission classes

```yaml
pr: 4aea8dd6
type: aspect-affecting
required_updates:
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Update the OR composition semantics section. The old behavior evaluated has_object_permission independently from has_permission. New behavior: OR.has_object_permission now re-checks has_permission for each operand, ensuring a request must pass BOTH has_permission AND has_object_permission on at least one branch. This is a semantic change to the composition operators."
    source: "Diff in permissions.py lines 78-85; commit message explains the old vs new semantic"
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Update OR class contract: has_object_permission now evaluates (op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission), not simply op1.has_object_permission OR op2.has_object_permission."
    source: "Diff in permissions.py"
  - target: aspects/operator-composition/requirements.md
    operation: modify
    description: "Update the operator-composition aspect to reflect the corrected OR semantics. The OR operator now couples has_permission and has_object_permission checks per operand, rather than evaluating them independently."
    source: "Diff + commit message"
decisions_in_pr:
  - decision: "Chose coupled has_permission+has_object_permission per branch over independent evaluation, because independent evaluation allowed a request that fails on object permission for class A and fails on view permission for class B to still pass the OR check."
    source: "Commit message body"
    should_be_captured: true
```
