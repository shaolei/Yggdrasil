# Structural Comparison: DRF Reference vs Auto-Constructed

## Node Coverage

| Reference Node | Auto Node | Match? | Notes |
|---|---|---|---|
| `request-pipeline` (parent) | `drf` (parent) | Yes | Same role, different name |
| `request-pipeline/api-view` | `drf/views` | Yes | Same file: `views.py` |
| `request-pipeline/request` | `drf/request` | Yes | Same file: `request.py` |
| `request-pipeline/authentication` | `drf/authentication` | Yes | Same file: `authentication.py` |
| `request-pipeline/permissions` | `drf/permissions` | Yes | Same file: `permissions.py` |
| `request-pipeline/throttling` | `drf/throttling` | Yes | Same file: `throttling.py` |

**Node coverage: 6/6 = 100%**

**Node granularity match: 6/6 = 100%** (identical granularity)

## Relation Coverage

| Reference Relation | Auto Relation | Match? |
|---|---|---|
| api-view -> request (calls: Request, clone_request) | views -> request (calls: Request, clone_request) | Yes |
| api-view -> authentication (uses: authenticate, authenticate_header) | views -> authentication (uses: authenticate_header) | Partial -- missing `authenticate` |
| api-view -> permissions (uses: has_permission, has_object_permission) | views -> permissions (uses: has_permission, has_object_permission) | Yes |
| api-view -> throttling (uses: allow_request, wait) | views -> throttling (uses: allow_request, wait) | Yes |
| request -> authentication (uses: authenticate) | request -> authentication (uses: authenticate) | Yes |

**Relation coverage: 5/5 = 100%** (all reference relations present; one has partial consumes list)

## Aspect Coverage

| Reference Aspect | Auto Aspect | Match? | Notes |
|---|---|---|---|
| `class-based-policy` | `pluggable-policy` | Yes | Same pattern: class attrs + get_*() factory methods |
| `lazy-evaluation` | `lazy-authentication` | Partial | Auto aspect covers only auth laziness, reference also covers `data` property laziness |
| `operator-composition` | `permission-composition` | Yes | Same pattern: &, \|, ~ operators on permissions |
| (none) | `csrf-session-enforcement` | Bonus | Not a reference aspect; auto extracted it as cross-cutting |
| (none) | `sliding-window-throttle` | Bonus | Not a reference aspect; auto extracted it as cross-cutting |

**Aspect coverage: 3/3 = 100%** (all reference aspects matched)

**Aspect precision: 3/5 = 60%** (2 bonus aspects have no reference counterpart -- not errors, but extra)

## Flow Coverage

| Reference Flow | Auto Flow | Match? |
|---|---|---|
| `api-request-processing` | `request-lifecycle` | Yes |

**Flow coverage: 1/1 = 100%**

## File Mapping Coverage

| Reference Mapping | Auto Mapping | Match? |
|---|---|---|
| `views.py` on api-view | `views.py` on views | Yes |
| `request.py` on request | `request.py` on request | Yes |
| `authentication.py` on authentication | `authentication.py` on authentication | Yes |
| `permissions.py` on permissions | `permissions.py` on permissions | Yes |
| `throttling.py` on throttling | `throttling.py` on throttling | Yes |
| All 5 files on parent `request-pipeline` | No files on parent `drf` (paths: []) | Partial |

**File mapping precision: 100%** (all auto mappings are correct)
**File mapping recall: 5/6 = 83%** (parent node mapping missing in auto)

## Summary

| Element | Coverage |
|---|---|
| Nodes | 100% (6/6) |
| Relations | 100% (5/5) |
| Aspects | 100% (3/3) |
| Flows | 100% (1/1) |
| Node granularity | 100% (6/6) |
| File mapping precision | 100% |
| File mapping recall | 83% |

**Structural coverage = mean(100, 100, 100, 100) = 100%**

**Structural precision = (6 nodes + 5 relations + 3 matching aspects + 1 flow) / (6 + 5 + 5 + 1) = 15/17 = 88%** (2 bonus aspects reduce precision)
