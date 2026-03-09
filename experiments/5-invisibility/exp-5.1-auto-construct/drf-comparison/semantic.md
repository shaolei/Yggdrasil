# Semantic Comparison: DRF Reference vs Auto-Constructed

## Per-Node Artifact Scores

Scale: 1 (minimal) / 2 (partial) / 3 (equivalent)

### Parent Node (request-pipeline / drf)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both capture the same identity and boundaries. Auto adds explicit "boundaries" section. |

### APIView (api-view / views)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Same identity, same not-responsible-for list. Auto slightly more verbose. |
| interface.md | 3 | Same class attributes, same methods, same failure modes. Auto omits table format for attributes but covers the same content. Reference has slightly more detail on `finalize_response` Vary header behavior. |
| internals.md | 3 | Both cover dispatch sequence, 401/403 coercion, CSRF strategy, queryset guard. Auto adds extra decisions from git history (Vary header patching, initial() reorder, set_rollback). |

### Request (request / request)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Same identity and boundaries. |
| interface.md | 3 | Same constructor, properties, functions, failure modes. |
| internals.md | 3 | Same auth sequence, parsing, sentinel pattern. Auto adds stream handling details, attribute proxy details with commit references. |

### Authentication (authentication / authentication)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Same identity and boundaries. Auto adds OAuth removal as a boundary note. |
| interface.md | 3 | Same base class, all 4 implementations, utility functions, failure modes. Auto includes commit references. |
| internals.md | 2 | Both cover three-outcome protocol, CSRF enforcement, Latin-1 fallback. Reference has more detail (CSRF as PermissionDenied rationale, select_related optimization, first-authenticator-only header). Auto adds OAuth removal decision and customizable keyword decision. |

### Permissions (permissions / permissions)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Same identity and boundaries. |
| interface.md | 3 | Same content: BasePermission, all built-ins, composition operators, failure modes. |
| internals.md | 3 | Both cover OR object permission semantics, 404 masking, metaclass approach. Auto adds rejection-of-anonymous-before-queryset from commit history. Reference has separate SAFE_METHODS decision. |

### Throttling (throttling / throttling)

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Same identity and boundaries. |
| interface.md | 3 | Same base class, SimpleRateThrottle, all built-ins, failure modes. |
| internals.md | 3 | Both cover sliding window algorithm, client identification, ScopedRateThrottle deferred init. Same decisions (list over deque, cache-backed). Auto adds "all throttles checked, not short-circuited" from commit history. |

## Artifact Score Summary

| Node | responsibility | interface | internals | Mean |
|---|---|---|---|---|
| Parent | 3 | -- | -- | 3.0 |
| APIView | 3 | 3 | 3 | 3.0 |
| Request | 3 | 3 | 3 | 3.0 |
| Authentication | 3 | 3 | 2 | 2.67 |
| Permissions | 3 | 3 | 3 | 3.0 |
| Throttling | 3 | 3 | 3 | 3.0 |

**Mean artifact score: 2.94 / 3 = 98%**

## Aspect Semantic Comparison

| Reference Aspect | Auto Aspect | Pattern Match | Rationale Match | Score |
|---|---|---|---|---|
| class-based-policy | pluggable-policy | 3 (equivalent) | 3 (same why) | 3.0 |
| lazy-evaluation | lazy-authentication | 2 (partial -- misses data laziness) | 2 (same auth rationale, misses data/parsing rationale) | 2.0 |
| operator-composition | permission-composition | 3 (equivalent) | 3 (auto adds commit-based evolution history) | 3.0 |

**Mean aspect score: 2.67 / 3 = 89%**

## Flow Semantic Comparison

| Element | Score | Notes |
|---|---|---|
| Business context | 3 | Same description |
| Trigger | 3 | Identical |
| Goal | 3 | Same |
| Participants | 3 | Same 5 participants |
| Happy path | 3 | Same sequence with same details |
| Failure paths | 3 | Same 4 paths (auth, permission, throttle, unhandled) |
| Invariants | 3 | Same 4 invariants |

**Flow score: 3.0 / 3 = 100%**

## Semantic Coverage

**Overall semantic coverage = mean(98%, 89%, 100%) = 95.7%**

## Decision Capture Rate

Reference decisions (from internals.md across all nodes):

1. CSRF exempt at as_view() not dispatch() -- **Found in auto** (views internals)
2. 401->403 coercion when no auth header -- **Found in auto** (views internals)
3. Permission denied distinguishes not-logged-in from not-allowed -- **Found in auto** (views internals)
4. check_object_permissions not called automatically -- **Not found in auto** (mentioned in interface but not as explicit decision)
5. Django 5.1 LoginRequiredMiddleware exemption -- **Found in auto** (views interface, as_view description)
6. Session auth reads from _request.user not request.user -- **Not found in auto**
7. Only first authenticator's header used -- **Not found in auto**
8. Object permissions not checked automatically -- **Not found in auto** (mentioned in interface only)
9. 404 masking for unauthorized objects -- **Found in auto** (permissions internals)
10. Separate SAFE_METHODS constant -- **Not found in auto**
11. AllowAny exists despite being no-op -- **Found in auto** (permissions internals + interface)
12. Empty sentinel class over None -- **Found in auto** (request internals)
13. WrappedAttributeError over bare AttributeError -- **Found in auto** (request internals)
14. Fill empty data before re-raising parse errors -- **Not found in auto**
15. ForcedAuthentication replaces authenticators -- **Not found in auto** (mentioned in interface, not as decision)
16. Sliding window over fixed window -- **Found in auto** (sliding-window-throttle aspect)
17. Cache-backed over in-memory -- **Found in auto** (throttling internals)
18. Timestamps list over counter -- **Not found in auto**
19. AnonRateThrottle skips authenticated users -- **Not found in auto** (mentioned in interface)
20. ScopedRateThrottle overrides __init__ -- **Found in auto** (throttling internals)
21. CSRF failure as PermissionDenied not AuthenticationFailed -- **Not found in auto**

**Decision capture rate: 11/21 = 52%**

## "Why NOT" Capture Rate

Reference rejected alternatives (explicit "Chose X over Y"):

1. CSRF in as_view() over dispatch() -- **Found** (auto views internals)
2. 401->403 coercion over always 401 -- **Found** (auto views internals, partially)
3. NotAuthenticated over PermissionDenied for unauthenticated -- **Found** (auto views internals)
4. Explicit check_object_permissions over automatic -- **Not found**
5. Empty class over None sentinel -- **Found** (auto request internals)
6. WrappedAttributeError over bare -- **Found** (auto request internals)
7. Fill empty before re-raise over leaving Empty -- **Not found**
8. Object 404 over 403 for enumeration protection -- **Found** (auto permissions internals)
9. AllowAny class over empty list -- **Found** (auto permissions)
10. Sliding window over fixed window -- **Partially found** (mentioned in aspect but not as explicit "chose X over Y")
11. Cache-backed over in-memory -- **Found** (auto throttling internals)
12. Timestamps list over counter -- **Not found**

**"Why NOT" capture rate: 8/12 = 67%**

## Fabrication Rate

Reviewing all auto-graph claims for fabrication (claims not in reference AND not in source code):

No fabricated claims identified. All auto-graph claims are either:
- Present in the reference graph, or
- Verifiable from source code and git history (commit references are real)

The auto graph includes additional commit-referenced details not in the reference, but these are sourced from actual git history, not fabricated.

**Fabrication rate: 0%**
