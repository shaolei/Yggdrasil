# Auto Patch: Commit 3 — Fix infinite recursion with deepcopy on Request

```yaml
pr: d507cd85
type: bugfix
required_updates:
  - target: request-pipeline/request/internals.md
    operation: modify
    description: "Document __getattr__ fix for deepcopy: uses __getattribute__('_request') to avoid infinite recursion when the object has no __dict__ (as during deepcopy initialization)."
    source: "Diff in request.py lines 413-418"
decisions_in_pr: []
no_update_needed: []
```
