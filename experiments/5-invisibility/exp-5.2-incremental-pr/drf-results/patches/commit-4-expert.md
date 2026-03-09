# Expert Patch: Commit 4 — Preserve exception messages for wrapped Django exceptions

```yaml
pr: 56946fac
type: bugfix
required_updates:
  - target: request-pipeline/api-view/internals.md
    operation: modify
    description: "Update exception_handler documentation: when wrapping Django Http404 and PermissionDenied into DRF exceptions, the original exception args are now preserved (passed through via *(exc.args)). Previously, wrapped exceptions lost their messages."
    source: "Diff in views.py lines 79-84"
  - target: request-pipeline/api-view/interface.md
    operation: modify
    description: "Update exception_handler contract: note that wrapped Django exceptions now preserve their original message text."
    source: "Diff in views.py"
decisions_in_pr: []
```
