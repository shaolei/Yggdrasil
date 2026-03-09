# Semantic Comparison: Reference vs Guided Graph

## Depth Scale

- **3 (Equivalent)**: Captures the same information, possibly worded differently
- **2 (Partial)**: Captures the core concept but misses important details
- **1 (Minimal)**: Present but shallow, missing most depth

## Per-Node Artifact Comparison

### APIView

| Artifact | Reference Depth | Guided Depth | Score | Notes |
|---|---|---|---|---|
| responsibility.md | Full (6 responsibilities, 4 exclusions) | Full (7 responsibilities, 4 exclusions) | 3 | Equivalent. Guided actually lists more detail. |
| interface.md | Extensive (table of class attrs, all methods with signatures, failure mode table, module-level functions) | Good (key methods, policy config, failure modes) | 2 | Missing: `as_view()` details, `finalize_response()`, `get_view_name/description`, schema attr, settings injection, module-level `exception_handler`/`set_rollback` functions |
| internals.md | 5 decisions, dispatch sequence, CSRF strategy, content negotiation fallback, queryset guard | 2 decisions, dispatch flow, 401/403 coercion, CSRF, queryset guard | 2 | Missing decisions: check_object_permissions not automatic, Django 5.1 LoginRequired exemption, permission_denied 401 vs 403 distinction. Missing: content negotiation forced fallback |

### Authentication

| Artifact | Reference Depth | Guided Depth | Score | Notes |
|---|---|---|---|---|
| responsibility.md | 4 responsibilities, 3 exclusions | 5 responsibilities, 4 exclusions | 3 | Equivalent |
| interface.md | All 4 classes with method signatures, failure mode table, module-level utilities (CSRFCheck, get_authorization_header) | All 4 classes with method signatures, failure modes | 2 | Missing: `authenticate_credentials` methods, `get_model()`, module-level `get_authorization_header()`, `CSRFCheck` as separate entry |
| internals.md | Three-outcome protocol, CSRF scope, CSRF as PermissionDenied, Basic encoding, token lazy import, select_related, 3 decisions | Multi-auth resolution, CSRF, Basic encoding, 2 decisions | 2 | Missing decisions: session reads _request.user (recursion avoidance), only first authenticator header used. Missing: token lazy import, select_related optimization |

### Permissions

| Artifact | Reference Depth | Guided Depth | Score | Notes |
|---|---|---|---|---|
| responsibility.md | 4 responsibilities, 3 exclusions | 5 responsibilities, 3 exclusions | 3 | Equivalent |
| interface.md | Full API (BasePermission with class attrs message/code, all built-in classes, operator composition mechanics, failure table) | Full API (BasePermission, all built-in classes, OR composition detail, failure modes) | 3 | Very close. Guided captures OR object permission semantics well. Missing: message/code attrs, DjangoModelPermissionsOrAnonReadOnly, metaclass mention |
| internals.md | Two-level model, OR logic, 404 masking, metaclass, DefaultRouter workaround, 4 decisions | OR semantics, 404 masking, 2 decisions | 2 | Missing: two-level model explanation, metaclass mechanics, DefaultRouter workaround, decisions (object permissions not auto, AllowAny exists despite no-op, SAFE_METHODS constant) |

### Request

| Artifact | Reference Depth | Guided Depth | Score | Notes |
|---|---|---|---|---|
| responsibility.md | 4 responsibilities (includes "unified data access"), 3 exclusions | 7 responsibilities, 4 exclusions | 3 | Guided is MORE detailed (adds clone_request, content type detection, forced auth) |
| interface.md | Full API (constructor, all properties with types, POST/FILES, attribute proxy, clone_request, override_method, wrap_attributeerrors, is_form_media_type, failure table) | Good (constructor, lazy properties, attribute proxying, failure modes) | 2 | Missing: POST/FILES properties, clone_request, override_method, is_form_media_type, force_plaintext_errors detail is minimal |
| internals.md | Auth sequence, parsing sequence, sentinel pattern, form data back-sync, state listing, 4 decisions | Auth pipeline, lazy mechanism, parse error recovery, 2 decisions | 2 | Missing: parsing sequence detail, form data back-sync, state listing, decisions (fill empty data before re-raise, ForcedAuthentication replaces authenticators) |

### Throttling

| Artifact | Reference Depth | Guided Depth | Score | Notes |
|---|---|---|---|---|
| responsibility.md | 5 responsibilities, 3 exclusions | 5 responsibilities, 3 exclusions | 3 | Equivalent |
| interface.md | Full API (BaseThrottle methods, SimpleRateThrottle class attrs table, all methods including throttle_success/failure, all built-in classes, failure table) | Good (BaseThrottle, SimpleRateThrottle, all built-in classes, failure modes) | 2 | Missing: timer attr (injectable for testing), throttle_success/throttle_failure as separate methods, parse_rate detail, get_rate method |
| internals.md | Sliding window, wait calc, proxy-aware ident, ScopedRateThrottle deferred init, state (with thread-safety note), 5 decisions | Sliding window, ScopedRateThrottle, wait calc, 2 decisions | 2 | Missing: proxy-aware identification detail, state with thread-safety note, decisions (timestamps over counter, AnonRateThrottle skips auth users, ScopedRateThrottle override) |

## Aspect Content Comparison

### class-based-policy (ref) vs policy-pattern + class-based-configuration (guided)

| Dimension | Reference | Guided (combined) | Score |
|---|---|---|---|
| What | Detailed (class attrs, factory methods, per-request instantiation) | Split across two aspects — policy-pattern covers iteration, class-based-config covers settings hierarchy | 3 |
| Why | Clear (per-view override without subclassing) | Present in both aspects | 3 |
| Rules | 4 explicit rules including fixed execution order | Variation section covers iteration differences | 2 |
| Missing | - | Rule about classes (not instances) stored as attrs; rule about get_*() factories | - |

### lazy-evaluation

| Dimension | Reference | Guided | Score |
|---|---|---|---|
| What | Properties, sentinel, trigger conditions | Same content | 3 |
| Why | Avoids unnecessary work (DELETE doesn't parse) | Not explicitly stated in guided | 2 |
| Rules | 4 explicit rules (init must NOT call, sentinel checks, wrap_attributeerrors, perform_authentication override) | Mechanism and constraint sections cover same content | 3 |
| Exception | perform_authentication forcing mentioned in rules | Dedicated "Exception: Eager Forcing" section — MORE detailed than reference | 3 |

### operator-composition (ref) vs (inline in guided)

| Dimension | Reference | Guided | Score |
|---|---|---|---|
| Aspect exists | Yes (dedicated aspect) | No (content in permissions interface/internals) | 0 |
| Content captured | What/Why/4 Rules | OR semantics captured well in interface and internals | 2 |
| Cross-module visibility | Available to all nodes via aspect | Only visible when reading permissions node | 1 |

## Decision Coverage

| Node | Reference Decisions | Guided Decisions | Coverage |
|---|---|---|---|
| api-view | 5 | 2 | 40% |
| authentication | 2 | 2 | 100% |
| permissions | 4 | 2 | 50% |
| request | 4 | 2 | 50% |
| throttling | 5 | 2 | 40% |
| **Total** | **20** | **10** | **50%** |

## "Why NOT" Coverage (Rejected Alternatives)

| Node | Reference "Why NOT" | Guided "Why NOT" | Coverage |
|---|---|---|---|
| api-view | CSRF at as_view not dispatch, 401 coercion over always-401, NotAuthenticated vs PermissionDenied | Throttle collect vs short-circuit, set_rollback over commit | 40% |
| authentication | CSRF split rationale, 403 over 401 for session | CSRF split, 403 for session | 100% |
| permissions | Composition over custom classes, 404 over 403 masking | Composition over custom classes, 404 masking | 100% |
| request | Wrapper over subclass, Empty over None | Wrapper over subclass, Empty over None | 100% |
| throttling | Sliding over fixed, cache over memory, timestamps over counter | Sliding over fixed, cache over database | 67% |
| **Total alternatives documented** | **~15** | **~10** | **67%** |

## Constraint Coverage (Non-Obvious Constraints)

| Constraint | Reference | Guided |
|---|---|---|
| wrap_attributeerrors mandatory | Yes (aspect + request internals) | Yes (aspect + request internals) |
| Pipeline order (auth -> perms -> throttle) | Yes (aspect + flow + internals) | Yes (flow + internals) |
| check_object_permissions must be explicit | Yes (internals decision) | No |
| Content negotiation before security checks | Yes (flow invariants) | Yes (flow invariants) |
| set_rollback on ATOMIC_REQUESTS | Yes (flow invariants) | Yes (flow + internals) |
| Cache must support Python lists | No | Yes (throttling constraints) |
| Queryset evaluation guard | Yes (internals) | Yes (internals) |
| Only first authenticator's header used | Yes (internals decision) | No |
| Form data back-sync to _request | Yes (internals) | No |
| **Coverage** | - | **~67%** |

## Aggregate Semantic Scores

| Artifact Type | Avg Score (out of 3) | Percentage |
|---|---|---|
| responsibility.md | 3.0 | 100% |
| interface.md | 2.2 | 73% |
| internals.md | 2.0 | 67% |
| Aspects | 2.3 | 77% |
| Flow | 2.5 | 83% |
| Decisions | - | 50% |
| "Why NOT" | - | 67% |
| Constraints | - | 67% |

## Key Finding

The guided graph captures WHAT well (responsibility ~100%) and HOW-TO-USE reasonably (interface ~73%), but loses depth on HOW-IT-WORKS-AND-WHY (internals ~67%, decisions 50%). This matches the extraction analysis finding that Phase D (decision extraction) had the highest miss rate.
