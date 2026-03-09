# Auto Patch: Commit 8 — Respect can_read_model permission in DjangoModelPermissions

```yaml
pr: 0618fa88
type: interface-change
required_updates:
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "DjangoModelPermissions.perms_map now requires view permission for GET and HEAD. GET has fallback: passes with view_<model> OR change_<model> permission."
    source: "Diff in permissions.py lines 186-248"
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Document GET permission fallback logic: check view permission first, fall back to change permission for backward compatibility."
    source: "Diff in permissions.py lines 239-248"
decisions_in_pr:
  - decision: "Added view permission requirement for GET/HEAD with change permission fallback for backward compatibility."
    source: "Commit message + issue #6324"
    should_be_captured: true
```
