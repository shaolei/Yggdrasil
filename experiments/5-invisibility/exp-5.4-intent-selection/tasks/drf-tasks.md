# DRF Tasks — Experiment 5.4

## Graph Summary

**Nodes (5 leaf + 1 parent):**
- `request-pipeline` (parent module)
- `request-pipeline/api-view` (service) — orchestrates pipeline
- `request-pipeline/authentication` (infrastructure) — authenticator base classes
- `request-pipeline/permissions` (infrastructure) — permission base + operator composition
- `request-pipeline/request` (service) — wraps Django HttpRequest, lazy evaluation
- `request-pipeline/throttling` (infrastructure) — rate limiting base classes

**Aspects:** class-based-policy, lazy-evaluation, operator-composition
**Flows:** api-request-processing (all 5 leaf nodes)

---

## Tasks

### T01 — Single-module
**Description:** "Add a new built-in permission class that checks if the user belongs to a specific group."
**Complexity:** single-module
**Expert-selected nodes:** `permissions`
**Relevant aspects:** class-based-policy, operator-composition
**Rationale:** Only touches permissions.py; needs to follow BasePermission pattern.

### T02 — Single-module
**Description:** "Fix a bug where the Request object's `.data` property is evaluated twice when accessed concurrently from a middleware."
**Complexity:** single-module
**Expert-selected nodes:** `request`
**Relevant aspects:** lazy-evaluation
**Rationale:** Entirely within the Request class lazy evaluation logic.

### T03 — Single-module
**Description:** "Add a new throttle scope that limits requests per user per day instead of per minute."
**Complexity:** single-module
**Expert-selected nodes:** `throttling`
**Relevant aspects:** class-based-policy
**Rationale:** Only touches throttling.py; must follow BaseThrottle pattern.

### T04 — Cross-module
**Description:** "When authentication fails, the 401 response should include which authentication methods were attempted."
**Complexity:** cross-module
**Expert-selected nodes:** `api-view`, `authentication`
**Relevant aspects:** class-based-policy
**Rationale:** APIView.handle_exception produces the response but needs info from authenticators about which methods were tried.

### T05 — Cross-module
**Description:** "Allow permission classes to access the parsed request body during has_permission checks."
**Complexity:** cross-module
**Expert-selected nodes:** `permissions`, `request`, `api-view`
**Relevant aspects:** class-based-policy, lazy-evaluation
**Rationale:** Permissions run in initial() before handler; request.data is lazy. Needs understanding of evaluation order and lazy loading.

### T06 — Cross-module
**Description:** "Add a mechanism to skip throttling for requests that have already been authenticated with a specific authentication class."
**Complexity:** cross-module
**Expert-selected nodes:** `api-view`, `throttling`, `authentication`
**Relevant aspects:** class-based-policy
**Rationale:** Throttling runs after authentication in initial(); needs to inspect which authenticator succeeded.

### T07 — Flow-spanning
**Description:** "Add audit logging that records every step of the request processing pipeline — which authenticator matched, which permissions passed, which throttle was checked."
**Complexity:** flow-spanning
**Expert-selected nodes:** `api-view`, `authentication`, `permissions`, `throttling`
**Relevant aspects:** class-based-policy
**Relevant flows:** api-request-processing
**Rationale:** Spans the entire pipeline; needs to understand ordering and each step's output.

### T08 — Flow-spanning
**Description:** "Refactor the request processing pipeline so that the order of authentication, permissions, and throttling checks can be configured per-view."
**Complexity:** flow-spanning
**Expert-selected nodes:** `api-view`, `authentication`, `permissions`, `throttling`
**Relevant aspects:** class-based-policy
**Relevant flows:** api-request-processing
**Rationale:** The fixed order (auth→perms→throttle) is an invariant of the flow; changing it affects all participants.

### T09 — Constraint-aware
**Description:** "Add caching to permission checks so the same permission class is not evaluated twice for the same request."
**Complexity:** constraint-aware
**Expert-selected nodes:** `api-view`, `permissions`
**Relevant aspects:** class-based-policy, operator-composition
**Rationale:** Must be aware that operator-composed permissions (AND/OR/NOT) create nested evaluations; caching must respect composition semantics.

### T10 — Ambiguous
**Description:** "Improve the performance of request handling."
**Complexity:** ambiguous
**Expert-selected nodes:** `api-view`, `request`, `authentication`, `permissions`, `throttling`
**Relevant aspects:** class-based-policy, lazy-evaluation
**Rationale:** Ambiguous — could mean any part of the pipeline. Expert would select all nodes to understand bottlenecks.
