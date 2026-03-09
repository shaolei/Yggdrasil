# Expert Patch: Commit 8 — Respect can_read_model permission in DjangoModelPermissions

```yaml
pr: 0618fa88
type: interface-change
required_updates:
  - target: request-pipeline/permissions/interface.md
    operation: modify
    description: "Major interface change to DjangoModelPermissions: perms_map now requires view permission for GET and HEAD requests (was previously empty). GET requests use fallback logic: passes if user has view permission OR change permission. This is a breaking change for users who relied on empty GET/HEAD permission lists."
    source: "Diff in permissions.py lines 186-248"
  - target: request-pipeline/permissions/internals.md
    operation: modify
    description: "Document the new GET permission fallback: has_permission now checks view_<model> permission first, falls back to change_<model> for GET requests. This accommodates Django's add of view permission in Django 2.1 while maintaining backward compatibility for users who only had change permission."
    source: "Diff in permissions.py lines 239-248"
  - target: request-pipeline/permissions/responsibility.md
    operation: modify
    description: "Update to reflect that DjangoModelPermissions now enforces read (view) permissions by default, not just write permissions."
    source: "Diff — perms_map change"
decisions_in_pr:
  - decision: "Chose to require view permission for GET/HEAD by default (with change permission fallback) over keeping GET/HEAD unrestricted, because Django 2.1+ provides a view permission and DRF should respect it."
    source: "Commit message referencing issue #6324 + 'simplified code'"
    should_be_captured: true
  - decision: "Chose GET fallback to change permission over strict view-only check, to maintain backward compatibility for users who only have change permission configured."
    source: "Inferred from code: the or user.has_perms(change_perm) fallback"
    should_be_captured: true
```
