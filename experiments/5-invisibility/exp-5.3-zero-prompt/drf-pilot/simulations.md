# Simulations — Per-Condition, Per-Task Scoring

Scoring dimensions: Correctness (1-5), Completeness (1-5), Safety (1-5), Constraint Respect (1-5), Efficiency (1-5). Max per task = 25.

---

## T01: Bug Fix — CSRF 403 vs 401

### C0 (No Graph)

**Approach**: Agent greps for CSRF handling, finds `SessionAuthentication.enforce_csrf()` raising `PermissionDenied`. Reads `handle_exception` in views.py to understand 401 vs 403 branching.

**Likely outcome**: Agent CAN find the code path through grep and reading. The 401 vs 403 distinction is visible in `handle_exception`. However, the agent may not fully grasp WHY `PermissionDenied` is used instead of `AuthenticationFailed` — it might suggest "fixing" it to raise `AuthenticationFailed`, especially since the task frames it as a potential bug.

**Solution proposed**: 50% chance: correctly identifies it as intentional and explains rationale (by reading the code flow carefully). 50% chance: proposes changing to `AuthenticationFailed` as a "fix."

**Scores** (averaging the two outcomes):
- Correctness: 3 — May correctly trace the code, but risk of proposing a harmful change
- Completeness: 3 — Can explain the mechanism but likely misses the WWW-Authenticate / browser login dialog implications
- Safety: 3 — Risk of proposing a breaking change if agent thinks it's a bug
- Constraint Respect: 3 — May not recognize the semantic distinction is a design constraint
- Efficiency: 4 — Straightforward investigation

**Total: 16/25**

### C1 (Manual yg)

**Approach**: Agent runs `yg owner --file authentication.py`, gets authentication node. Runs `yg build-context`, reads internals.md which explains the CSRF → PermissionDenied rationale. Reads the flow's permission denied path. Clearly sees it's intentional.

**Likely outcome**: Correctly identifies the behavior as intentional. Explains the full rationale: semantic correctness (user IS authenticated), WWW-Authenticate header implications, browser dialog prevention.

**Scores**:
- Correctness: 5 — Correctly identifies as intentional with full reasoning
- Completeness: 5 — Covers all downstream effects
- Safety: 5 — Does not propose breaking changes
- Constraint Respect: 5 — Recognizes the design constraint
- Efficiency: 4 — Slight overhead from yg protocol steps

**Total: 24/25**

### C3 (Lazy Injection)

**Approach**: Agent receives background context including authentication internals (CSRF rationale), api-view interface (handle_exception), and the flow's permission denied path. Reads this as architectural documentation.

**Likely outcome**: Very similar to C1. The injected context explicitly covers the CSRF → PermissionDenied rationale and the 401/403 distinction. Agent correctly identifies it as intentional.

**Scores**:
- Correctness: 5 — Same information as C1, clearly states the rationale
- Completeness: 5 — Flow description covers the full path
- Safety: 5 — No breaking change proposed
- Constraint Respect: 5 — Constraint is explicit in injected context
- Efficiency: 5 — No yg protocol overhead, context pre-assembled

**Total: 25/25**

---

## T02: Feature Addition — Per-method throttle scope

### C0 (No Graph)

**Approach**: Agent reads `throttling.py`, finds `ScopedRateThrottle.get_cache_key()`. Reads `views.py` for `check_throttles()`. Proposes adding logic.

**Likely outcome**: Agent can read the code and figure out where to add the feature. Main risk: placing logic in `check_throttles()` on APIView rather than in `ScopedRateThrottle.get_cache_key()`. A good agent reading the code carefully would see the pattern and put it in the right place. Moderate risk of wrong placement.

**Scores**:
- Correctness: 4 — Likely gets the feature right
- Completeness: 4 — May miss fallback behavior edge cases
- Safety: 4 — Low risk of breaking existing behavior
- Constraint Respect: 3 — May place logic in view instead of throttle class (violating the policy class pattern)
- Efficiency: 4 — Reasonable implementation

**Total: 19/25**

### C1 (Manual yg)

**Approach**: Agent uses `yg build-context` on throttling node. Sees the class-based-policy aspect explaining that behavior belongs in policy classes. Reads throttling interface.md documenting the scope resolution chain.

**Likely outcome**: Correctly places logic in `ScopedRateThrottle.get_cache_key()`. Understands the full resolution chain.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5 — Follows the class-based-policy pattern
- Efficiency: 4

**Total: 24/25**

### C3 (Lazy Injection)

**Approach**: Agent receives throttling artifacts and the class-based-policy aspect. Reads the injected context, understands the pattern.

**Likely outcome**: Same as C1. The aspect explicitly says behavior belongs in policy classes.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5
- Efficiency: 5

**Total: 25/25**

---

## T03: Refactor — Extract _authenticate

### C0 (No Graph)

**Approach**: Agent reads `request.py`, finds `_authenticate()`. Reads the `wrap_attributeerrors` context manager. Must understand WHY it's there before moving code.

**Likely outcome**: The `WrappedAttributeError` mechanism is subtle. An agent reading the code may see `wrap_attributeerrors` but not fully understand why it exists (the `__getattr__` proxy interaction). High risk of:
- Moving `wrap_attributeerrors` into the standalone function (meaningless there)
- Or removing it entirely during the extract
- The lazy evaluation pattern may also be disrupted

**Scores**:
- Correctness: 3 — Basic extraction works but likely mishandles wrap_attributeerrors
- Completeness: 3 — May extract the iteration but miss the WrappedAttributeError constraint
- Safety: 2 — High risk of breaking the AttributeError swallowing protection
- Constraint Respect: 2 — Likely violates the lazy-evaluation aspect's rule about wrap_attributeerrors
- Efficiency: 4 — Extraction itself is straightforward

**Total: 14/25**

### C1 (Manual yg)

**Approach**: Agent runs `yg build-context` on request node. Reads internals.md explaining the WrappedAttributeError mechanism in detail. Reads the lazy-evaluation aspect explaining rule 3 (wrap_attributeerrors must protect against AttributeError swallowing).

**Likely outcome**: Correctly keeps `wrap_attributeerrors` in `Request._authenticate()` and only extracts the authenticator iteration logic into the standalone function.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5 — Preserves the WrappedAttributeError protection
- Constraint Respect: 5
- Efficiency: 4

**Total: 24/25**

### C3 (Lazy Injection)

**Approach**: Agent receives the lazy-evaluation aspect (explaining wrap_attributeerrors) and request internals.md (explaining WrappedAttributeError).

**Likely outcome**: Same quality as C1. The injected context makes the constraint explicit.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5
- Efficiency: 5

**Total: 25/25**

---

## T04: Cross-Module — Authenticator names in errors

### C0 (No Graph)

**Approach**: Agent reads `views.py`, finds `permission_denied()`. Needs to understand the 401 vs 403 decision logic. Reads `request.py` to find `authenticators` and `successful_authenticator` properties. Reads `exceptions.py` for NotAuthenticated.

**Likely outcome**: An agent can trace this by reading the code. The 401/403 logic in `permission_denied` is readable. Main risk: modifying the wrong hook (e.g., `handle_exception` instead of `permission_denied`) or modifying authenticator classes directly. A competent agent reading `permission_denied` should see it's the right place.

**Scores**:
- Correctness: 4 — Can trace the code path
- Completeness: 3 — May miss that the info should only appear in 401 responses, not 403
- Safety: 4 — Low risk if done at the right layer
- Constraint Respect: 3 — May modify authenticator classes (wrong layer)
- Efficiency: 4

**Total: 18/25**

### C1 (Manual yg)

**Approach**: Agent uses `yg build-context` on api-view. Sees `permission_denied()` documented with the 401/403 distinction. Uses `yg impact` to check what's affected by modifying the exception structure.

**Likely outcome**: Correctly modifies `permission_denied()`. Understands the information flow from Request.authenticators through permission_denied to NotAuthenticated.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5
- Efficiency: 4

**Total: 24/25**

### C3 (Lazy Injection)

**Approach**: Agent receives api-view interface (permission_denied documented), request interface (authenticators property), and the flow's permission denied path.

**Likely outcome**: Same as C1. The cross-module information flow is explicit in the injected context.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5
- Efficiency: 5

**Total: 25/25**

---

## T05: Constraint-Aware — Cache permissions

### C0 (No Graph)

**Approach**: Agent reads `views.py` `check_permissions()`. Reads `permissions.py` to understand permission classes. May attempt to implement a cache.

**Likely outcome**: Agent likely implements a cache keyed on (user, view, method). May not realize that:
- Permissions can depend on request.data (POST body)
- Permission instances are per-request and can be stateful
- OR's has_object_permission re-checks has_permission (caching individual results breaks this)

An experienced agent might notice some of these issues from reading the code, but the combination of all constraints is unlikely to be discovered through code reading alone.

**Scores**:
- Correctness: 2 — Likely implements a naive cache that misses key constraints
- Completeness: 2 — Misses multiple constraint interactions
- Safety: 1 — Cache would break data-dependent permissions and OR composition
- Constraint Respect: 1 — Violates per-request instantiation, stateful permission, and composition constraints
- Efficiency: 3 — Implementation is efficient but wrong

**Total: 9/25**

### C1 (Manual yg)

**Approach**: Agent runs `yg build-context` on permissions. Reads class-based-policy aspect (per-request instantiation). Reads operator-composition aspect (OR re-checks has_permission). Reads flow invariants. Likely concludes the change is unsafe.

**Likely outcome**: Correctly identifies the constraints and either rejects the change or proposes a very limited, opt-in version. Explains all the reasons caching is dangerous.

**Scores**:
- Correctness: 5 — Correctly identifies constraints
- Completeness: 5 — Covers all relevant constraints
- Safety: 5 — Does not introduce an unsafe cache
- Constraint Respect: 5 — Explicitly addresses each constraint
- Efficiency: 5 — Minimal or no code change (correct answer)

**Total: 25/25**

### C3 (Lazy Injection)

**Approach**: Agent receives class-based-policy aspect, operator-composition aspect, permissions internals, and flow invariants.

**Likely outcome**: Same as C1. The injected context makes all constraints visible upfront. Agent recognizes the danger.

**Scores**:
- Correctness: 5
- Completeness: 5
- Safety: 5
- Constraint Respect: 5
- Efficiency: 5

**Total: 25/25**

---

## Summary Table

| Task | C0 | C1 | C3 |
|------|-----|-----|-----|
| T01 (Bug Fix) | 16 | 24 | 25 |
| T02 (Feature) | 19 | 24 | 25 |
| T03 (Refactor) | 14 | 24 | 25 |
| T04 (Cross-Module) | 18 | 24 | 25 |
| T05 (Constraint) | 9 | 25 | 25 |
| **Total** | **76** | **121** | **125** |
| **Percentage of max** | **60.8%** | **96.8%** | **100%** |
