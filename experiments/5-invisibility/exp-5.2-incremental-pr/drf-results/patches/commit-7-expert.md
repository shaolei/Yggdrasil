# Expert Patch: Commit 7 — Check authentication before _ignore_model_permissions

```yaml
pr: c0d95cb9
type: bugfix
required_updates:
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Update DjangoModelPermissions.has_permission ordering: authentication check now runs BEFORE the _ignore_model_permissions bypass. Previously, if _ignore_model_permissions was True, has_permission returned True without checking authentication, allowing unauthenticated access to the root view."
    source: "Diff in permissions.py lines 228-240"
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Update DjangoModelPermissions.has_permission contract: even with _ignore_model_permissions=True, unauthenticated requests are rejected if authenticated_users_only is set."
    source: "Diff in permissions.py"
decisions_in_pr:
  - decision: "Chose to check authentication before _ignore_model_permissions rather than after, because the previous order allowed unauthenticated requests to bypass permission checks entirely on DefaultRouter root views."
    source: "Commit message referencing issue #8771"
    should_be_captured: true
```
