# DRF Results — Experiment 5.4

## Node Reference

| Short Name | Full Path |
|---|---|
| api-view | request-pipeline/api-view |
| authentication | request-pipeline/authentication |
| permissions | request-pipeline/permissions |
| request | request-pipeline/request |
| throttling | request-pipeline/throttling |

## Algorithm Execution

### S1: Keyword Matching

**Weights:** responsibility=3, interface=2, internals=1, aspect=2. Top-K by score.

| Task | Keywords | Top Nodes (by score) | Selected |
|---|---|---|---|
| T01 | permission, group, class, built-in | permissions (high: "permission" in resp+iface+aspect), api-view (med: "permission_classes" in iface) | permissions, api-view |
| T02 | request, data, property, evaluated, concurrently, middleware | request (high: "data property", "lazy evaluation"), api-view (low: "request" refs) | request, api-view |
| T03 | throttle, scope, limits, requests, user, day, minute | throttling (high: multiple hits), api-view (med: "throttle_classes") | throttling, api-view |
| T04 | authentication, fails, 401, response, methods, attempted | authentication (high), api-view (high: "handle_exception", "401") | authentication, api-view |
| T05 | permission, parsed, request, body, has_permission | permissions (high), request (high: "data", "parsed"), api-view (med: "permission") | permissions, request, api-view |
| T06 | skip, throttling, authenticated, authentication, class | throttling (high), authentication (high), api-view (high: all three terms) | api-view, throttling, authentication |
| T07 | audit, logging, step, pipeline, authenticator, permissions, throttle | api-view (high: pipeline orchestrator), authentication (med), permissions (med), throttling (med) | api-view, authentication, permissions, throttling |
| T08 | refactor, pipeline, order, authentication, permissions, throttling, configured, per-view | api-view (high: "initial()" order, pipeline), authentication (med), permissions (med), throttling (med) | api-view, authentication, permissions, throttling |
| T09 | caching, permission, checks, evaluated, twice, request | permissions (high), api-view (high: "check_permissions"), request (low) | permissions, api-view |
| T10 | improve, performance, request, handling | request (med), api-view (med: "request handling"), authentication (low), throttling (low) | request, api-view |

### S2: Flow-Based

**Rule:** Search flows for keyword matches. If match → select all flow participants + adjacent infrastructure.

| Task | Flow Match? | Selected |
|---|---|---|
| T01 | "permission" matches api-request-processing (mentions permissions) → all participants | api-view, request, authentication, permissions, throttling |
| T02 | "request" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T03 | "throttle" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T04 | "authentication fails" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T05 | "permission" + "request" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T06 | "throttling" + "authentication" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T07 | "pipeline" + "authenticator" + "permissions" + "throttle" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T08 | "pipeline" + "authentication" + "permissions" + "throttling" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T09 | "permission" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |
| T10 | "request handling" matches api-request-processing → all participants | api-view, request, authentication, permissions, throttling |

**Note:** DRF has only 1 flow containing all nodes, so S2 always selects everything.

### S3: Relation Traversal

**Rule:** S1 top-2 seeds → add direct dependents + dependencies + adjacent infrastructure. Limit K=5.

| Task | Seeds (S1 top-2) | Traversal adds | Selected (K≤5) |
|---|---|---|---|
| T01 | permissions, api-view | api-view→{authentication, permissions, throttling, request}; permissions has no outgoing | permissions, api-view, authentication, request, throttling |
| T02 | request, api-view | request→{authentication}; api-view→{authentication, permissions, throttling, request} | request, api-view, authentication, permissions, throttling |
| T03 | throttling, api-view | api-view→{request, authentication, permissions, throttling}; throttling has no outgoing | throttling, api-view, request, authentication, permissions |
| T04 | authentication, api-view | api-view→{request, authentication, permissions, throttling} | authentication, api-view, request, permissions, throttling |
| T05 | permissions, request | request→{authentication}; api-view depends on both (api-view is dependent of permissions and request) | permissions, request, api-view, authentication, throttling |
| T06 | api-view, throttling | api-view→{request, authentication, permissions, throttling} | api-view, throttling, request, authentication, permissions |
| T07 | api-view, authentication | api-view→{request, authentication, permissions, throttling} | api-view, authentication, request, permissions, throttling |
| T08 | api-view, authentication | same as T07 | api-view, authentication, request, permissions, throttling |
| T09 | permissions, api-view | api-view→{request, authentication, permissions, throttling} | permissions, api-view, request, authentication, throttling |
| T10 | request, api-view | same as T02 | request, api-view, authentication, permissions, throttling |

**Note:** DRF graph is small and highly connected (api-view depends on everything). S3 almost always selects all 5 nodes.

---

## Metrics

### Per-Task Precision / Recall / F1

| Task | Expert | S1 Selected | S1 P | S1 R | S1 F1 | S2 Selected | S2 P | S2 R | S2 F1 | S3 Selected | S3 P | S3 R | S3 F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T01 | perm | perm, av | 0.50 | 1.00 | 0.67 | all 5 | 0.20 | 1.00 | 0.33 | all 5 | 0.20 | 1.00 | 0.33 |
| T02 | req | req, av | 0.50 | 1.00 | 0.67 | all 5 | 0.20 | 1.00 | 0.33 | all 5 | 0.20 | 1.00 | 0.33 |
| T03 | thr | thr, av | 0.50 | 1.00 | 0.67 | all 5 | 0.20 | 1.00 | 0.33 | all 5 | 0.20 | 1.00 | 0.33 |
| T04 | av, auth | auth, av | 1.00 | 1.00 | 1.00 | all 5 | 0.40 | 1.00 | 0.57 | all 5 | 0.40 | 1.00 | 0.57 |
| T05 | perm, req, av | perm, req, av | 1.00 | 1.00 | 1.00 | all 5 | 0.60 | 1.00 | 0.75 | all 5 | 0.60 | 1.00 | 0.75 |
| T06 | av, thr, auth | av, thr, auth | 1.00 | 1.00 | 1.00 | all 5 | 0.60 | 1.00 | 0.75 | all 5 | 0.60 | 1.00 | 0.75 |
| T07 | av, auth, perm, thr | av, auth, perm, thr | 1.00 | 1.00 | 1.00 | all 5 | 0.80 | 1.00 | 0.89 | all 5 | 0.80 | 1.00 | 0.89 |
| T08 | av, auth, perm, thr | av, auth, perm, thr | 1.00 | 1.00 | 1.00 | all 5 | 0.80 | 1.00 | 0.89 | all 5 | 0.80 | 1.00 | 0.89 |
| T09 | av, perm | perm, av | 1.00 | 1.00 | 1.00 | all 5 | 0.40 | 1.00 | 0.57 | all 5 | 0.40 | 1.00 | 0.57 |
| T10 | av, req, auth, perm, thr | req, av | 0.50 | 0.40 | 0.44 | all 5 | 1.00 | 1.00 | 1.00 | all 5 | 1.00 | 1.00 | 1.00 |

**Legend:** av=api-view, auth=authentication, perm=permissions, req=request, thr=throttling

### Aggregate Metrics

| Algorithm | Mean Precision | Mean Recall | Mean F1 |
|---|---|---|---|
| **S1** | **0.80** | **0.94** | **0.84** |
| **S2** | **0.52** | **1.00** | **0.64** |
| **S3** | **0.52** | **1.00** | **0.64** |

### By Task Type

| Type | S1 P / R / F1 | S2 P / R / F1 | S3 P / R / F1 |
|---|---|---|---|
| Single-module (T01-T03) | 0.50 / 1.00 / 0.67 | 0.20 / 1.00 / 0.33 | 0.20 / 1.00 / 0.33 |
| Cross-module (T04-T06) | 1.00 / 1.00 / 1.00 | 0.53 / 1.00 / 0.69 | 0.53 / 1.00 / 0.69 |
| Flow-spanning (T07-T08) | 1.00 / 1.00 / 1.00 | 0.80 / 1.00 / 0.89 | 0.80 / 1.00 / 0.89 |
| Constraint-aware (T09) | 1.00 / 1.00 / 1.00 | 0.40 / 1.00 / 0.57 | 0.40 / 1.00 / 0.57 |
| Ambiguous (T10) | 0.50 / 0.40 / 0.44 | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 / 1.00 |

### Observations

- **S1 wins overall** due to precision advantage on single-module and cross-module tasks.
- **S2 and S3 are identical** because DRF has a single flow containing all nodes and a highly connected graph. Both degenerate to "select all."
- **S1 struggles with ambiguous tasks** (T10): vague descriptions produce weak keyword signal, selecting too few nodes.
- **S2/S3 handle ambiguous tasks perfectly** but at the cost of always over-selecting.
- DRF's small, fully-connected graph makes this repo a poor discriminator between algorithms.
