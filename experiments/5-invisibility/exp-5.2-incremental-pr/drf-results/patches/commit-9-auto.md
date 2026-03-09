# Auto Patch: Commit 9 — Add __hash__ method for OperandHolder

```yaml
pr: fe92f0dd
type: feature
required_updates:
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Add __hash__ method to OperandHolder. Hash based on (operator_class, op1_class, op2_class). Restores hashability after __eq__ was added."
    source: "Diff in permissions.py lines 56-58; commit message explains hashability motivation"
decisions_in_pr: []
```
