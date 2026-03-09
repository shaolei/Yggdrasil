# Structural Comparison: Reference vs Guided Graph

## Node Comparison

| Metric | Reference (E1) | Guided (E2) | Coverage |
|---|---|---|---|
| Total nodes | 6 (1 parent + 5 children) | 5 (no parent module) | 83% (5/6) |
| Leaf nodes | 5 | 5 | 100% |
| Parent/grouping nodes | 1 (request-pipeline) | 0 | 0% |

### Node-by-Node Match

| Reference Node | Guided Counterpart | Type Match |
|---|---|---|
| request-pipeline/api-view (service) | api-view (module) | Name match, type DIFFERS (service vs module) |
| request-pipeline/request (service) | request (module) | Name match, type DIFFERS (service vs module) |
| request-pipeline/authentication (infrastructure) | authentication (infrastructure) | Exact match |
| request-pipeline/permissions (infrastructure) | permissions (infrastructure) | Exact match |
| request-pipeline/throttling (infrastructure) | throttling (infrastructure) | Exact match |
| request-pipeline (module) | (none) | MISSING |

### Structural Differences

1. **No parent module**: Guided graph has flat structure (all nodes at model root). Reference uses a `request-pipeline` parent node with its own `responsibility.md` and `yg-node.yaml`. This means the guided graph lacks the hierarchical grouping and shared context.

2. **Node type mismatch**: APIView and Request are typed as `module` in guided vs `service` in reference. Infrastructure nodes match correctly, suggesting the extraction protocol's A4 question successfully identified middleware-like components.

## Relation Comparison

| Metric | Reference | Guided | Coverage |
|---|---|---|---|
| Total relations | 5 | 4 | 80% |
| Relations with `failure` field | 4 | 0 | 0% |
| Relations with `consumes` detail | 5 (detailed method names) | 4 (less specific) | 80% |

### Relation-by-Relation Match

| Reference Relation | Guided Counterpart | Detail Match |
|---|---|---|
| api-view → request (calls, consumes: Request, clone_request) | api-view → request (calls, consumes: Request) | Partial: missing `clone_request` |
| api-view → authentication (uses, consumes: authenticate, authenticate_header) | api-view → authentication (uses, consumes: BaseAuthentication) | Partial: less specific |
| api-view → permissions (uses, consumes: has_permission, has_object_permission) | api-view → permissions (uses, consumes: BasePermission, has_permission, has_object_permission) | Equivalent |
| api-view → throttling (uses, consumes: allow_request, wait) | api-view → throttling (uses, consumes: BaseThrottle, allow_request) | Partial: missing `wait` |
| request → authentication (uses, consumes: authenticate) | request → authentication (uses, consumes: authenticate) | Exact match |

### Key Differences

1. **No failure modes on relations**: Reference captures failure behavior on every relation (e.g., "Throttled -> handle_exception -> 429 with Retry-After"). Guided has zero. This is a significant loss of cross-module error context.

2. **Consumes granularity**: Reference specifies exact method names consumed. Guided sometimes lists base classes instead of methods.

## Aspect Comparison

| Metric | Reference | Guided | Coverage |
|---|---|---|---|
| Total aspects | 3 | 3 | 100% |

### Aspect-by-Aspect Match

| Reference Aspect | Guided Counterpart | Semantic Match |
|---|---|---|
| class-based-policy | policy-pattern + class-based-configuration | Split into 2 aspects (OVER-segmented) |
| lazy-evaluation | lazy-evaluation | Direct match |
| operator-composition | (none, captured in permissions internals.md) | MISSING as aspect |

### Analysis

- The guided graph split the reference's single `class-based-policy` aspect into two: `policy-pattern` (iteration strategy) and `class-based-configuration` (settings hierarchy). This is arguably MORE granular but the split means they appear as separate concerns rather than one unified pattern.
- `operator-composition` is missing as a named aspect. The content IS present in the permissions node's interface.md and internals.md, but without aspect status it cannot propagate to other nodes or appear in flow-level context.
- The guided graph's `policy-pattern` aspect captures the iteration strategy variation (first-match-wins, short-circuit, collect-all) which the reference captured in the same aspect. Good extraction.

## Flow Comparison

| Metric | Reference | Guided | Coverage |
|---|---|---|---|
| Total flows | 1 | 1 | 100% |
| Flow participants | 5 | 5 | 100% |
| Flow aspects | 1 (class-based-policy) | 1 (policy-pattern) | 100% |

The flows are structurally identical.

## File Mapping Comparison

| Metric | Reference | Guided | Coverage |
|---|---|---|---|
| Files mapped (leaf nodes) | 5 | 5 | 100% |
| Files mapped (parent node) | 5 (aggregate) | 0 | 0% |

Both map the same 5 source files. Reference also maps them at the parent level.

## Infrastructure Node Identification

| Metric | Reference | Guided |
|---|---|---|
| Infrastructure nodes | 3 (authentication, permissions, throttling) | 3 (authentication, permissions, throttling) |

Perfect match. The A4 extraction question ("components that affect others without being explicitly called") successfully identified all infrastructure nodes.

## Config Comparison

| Element | Reference | Guided |
|---|---|---|
| `standards` field | Populated (describes plugin-style architecture) | Empty string |
| Node types defined | Same 3 types | Same 3 types |
| Artifact config | Identical | Identical |
| Quality settings | Identical | Identical |

## Summary

| Dimension | Coverage |
|---|---|
| Leaf nodes | 100% (5/5) |
| Parent nodes | 0% (0/1) |
| Node types correct | 60% (3/5) |
| Relations | 80% (4/5) |
| Relation failure detail | 0% (0/4) |
| Aspects (semantic) | 67% (2/3 direct match, 1 split) |
| Flows | 100% |
| File mappings | 100% |
| Infrastructure nodes | 100% |
| **Overall structural coverage** | **~78%** |
