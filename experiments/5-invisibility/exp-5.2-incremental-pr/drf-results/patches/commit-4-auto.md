# Auto Patch: Commit 4 — Preserve exception messages for wrapped Django exceptions

```yaml
pr: 56946fac
type: bugfix
required_updates:
  - target: request-pipeline/api-view/internals.md
    operation: modify
    description: "Update exception_handler: Django Http404 and PermissionDenied exceptions now have their original args preserved when wrapped as DRF exceptions via *(exc.args)."
    source: "Diff in views.py lines 79-84"
  - target: request-pipeline/api-view/interface.md
    operation: modify
    description: "Update exception_handler contract to reflect that wrapped Django exceptions retain their original message."
    source: "Diff in views.py"
decisions_in_pr: []
```
