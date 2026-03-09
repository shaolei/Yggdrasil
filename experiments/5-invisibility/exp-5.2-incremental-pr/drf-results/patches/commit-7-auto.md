# Auto Patch: Commit 7 — Check authentication before _ignore_model_permissions

```yaml
pr: c0d95cb9
type: bugfix
required_updates:
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Update DjangoModelPermissions.has_permission: authentication check moved before _ignore_model_permissions check. Prevents unauthenticated access when _ignore_model_permissions is True."
    source: "Diff in permissions.py lines 228-240"
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Update DjangoModelPermissions contract: authentication is now always checked, even with _ignore_model_permissions=True."
    source: "Diff in permissions.py"
decisions_in_pr:
  - decision: "Moved auth check before _ignore_model_permissions to prevent unauthenticated access bypass on DefaultRouter root views."
    source: "Commit message + issue #8771"
    should_be_captured: true
```
