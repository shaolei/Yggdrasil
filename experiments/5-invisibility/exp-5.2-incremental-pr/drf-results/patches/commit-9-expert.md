# Expert Patch: Commit 9 — Add __hash__ method for OperandHolder

```yaml
pr: fe92f0dd
type: feature
required_updates:
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Add __hash__ method to OperandHolder documentation. Hash is based on (operator_class, op1_class, op2_class) tuple. This makes OperandHolder usable in sets and as dict keys, which was broken after __eq__ was added (Python removes default __hash__ when __eq__ is defined)."
    source: "Diff in permissions.py lines 56-58"
decisions_in_pr:
  - decision: "Hash uses same triple (operator_class, op1_class, op2_class) as __eq__, ensuring hash consistency."
    source: "Inferred from code"
    should_be_captured: false
```
