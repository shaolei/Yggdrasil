# PR Selection: Django REST Framework

## Target Area

Files: `rest_framework/views.py`, `request.py`, `authentication.py`, `permissions.py`, `throttling.py`

## Selected Commits (chronological order)

| # | Commit | Type | Summary | Files Changed |
|---|--------|------|---------|---------------|
| 1 | `4aea8dd6` | Aspect-affecting | Change semantic of OR of two permission classes | permissions.py |
| 2 | `0cb69370` | Feature | Add `__eq__` method for `OperandHolder` class | permissions.py |
| 3 | `d507cd85` | Bugfix | Fix infinite recursion with deepcopy on Request | request.py |
| 4 | `56946fac` | Bugfix | Preserve exception messages for wrapped Django exceptions | views.py |
| 5 | `1355890f` | Refactor | Replace `partition` with `split` in BasicAuthentication | authentication.py |
| 6 | `129890ab` | Bugfix | Fix error in throttling when request.user is None | throttling.py |
| 7 | `c0d95cb9` | Bugfix | Fix: check authentication before `_ignore_model_permissions` | permissions.py |
| 8 | `0618fa88` | Feature / Interface change | Respect `can_read_model` permission in DjangoModelPermissions | permissions.py |
| 9 | `fe92f0dd` | Feature | Add `__hash__` method for `OperandHolder` class | permissions.py |
| 10 | `e13688f0` | Refactor | Remove long deprecated code from request wrapper | request.py |

## Type Distribution

- Feature: 3 (#2, #8, #9)
- Bugfix: 4 (#3, #4, #6, #7)
- Refactor: 2 (#5, #10)
- Aspect-affecting: 1 (#1)
- Interface change: 1 (#8 overlaps)

Gap: No standalone interface-change-only commit found; #8 serves double duty as feature + interface change.
