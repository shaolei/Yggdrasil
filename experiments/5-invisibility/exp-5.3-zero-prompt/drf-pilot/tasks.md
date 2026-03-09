# Pilot Tasks — DRF Request Pipeline

## T01: Bug Fix — OR permission operator silently passes when it should fail

**Category**: bug_fix

**Description**: A developer reports that when using `permission_classes = [IsProjectMember | IsReadOnly]`, authenticated users who are NOT project members can still perform POST requests. The issue is in the permission composition logic. Find and fix the bug.

**Target files**: `rest_framework/permissions.py`

**Correct solution**: This is actually a trick task — the current `OR.has_object_permission()` implementation is correct (it re-checks `has_permission` per operand before checking `has_object_permission`). The real bug would be in the user's custom permission class `IsReadOnly` not properly returning False for unsafe methods at the `has_permission` level. The agent should investigate `OR.has_permission()` and `OR.has_object_permission()`, understand the composition semantics, and determine that the framework code is correct — the fix belongs in the user's permission class, not DRF itself.

**However, for a tractable task, let's reframe**: The bug is that `OR.has_object_permission()` is correct but `AND.has_object_permission()` does NOT re-check `has_permission` for each operand the way `OR` does. This means `AND` can pass object-level permissions for an operand that failed view-level permissions (since `check_permissions` already gates on the composed result). This is actually consistent behavior — AND already requires both to pass at view level. The agent should recognize this is NOT a bug.

**Reframed task**: A user reports: "When I use `SessionAuthentication` and send a POST request with a valid session but no CSRF token, I get a 403 instead of a 401. Shouldn't a CSRF failure indicate I need to re-authenticate?" Find where this behavior originates and explain whether it's a bug or intentional. If intentional, document why.

**Correct solution**: `SessionAuthentication.enforce_csrf()` deliberately raises `PermissionDenied` (403), not `AuthenticationFailed` (401). This is intentional: the user IS authenticated (session is valid), but the request is rejected for a security reason (missing CSRF). Returning 401 would incorrectly suggest re-authentication and trigger `WWW-Authenticate` headers / browser login dialogs. The fix is: no code change needed. The agent should explain the design rationale.

**Common mistakes without graph context**:
- Changing `enforce_csrf` to raise `AuthenticationFailed` (breaking the intentional distinction)
- Not understanding the 401 vs 403 distinction and its downstream effects on `handle_exception`
- Missing that `WWW-Authenticate` headers are only added for `AuthenticationFailed`, not `PermissionDenied`

**Graph information that helps**: Authentication node's internals.md explains the CSRF/PermissionDenied rationale. The flow description explains the permission denied path and the 401/403 distinction logic.

---

## T02: Feature Addition — Add a `throttle_scope` override mechanism per HTTP method

**Category**: feature_addition

**Description**: Add support for per-method throttle scopes on APIView. Currently, `ScopedRateThrottle` uses a single `throttle_scope` attribute on the view. Add support for a `throttle_scope_map` attribute (e.g., `throttle_scope_map = {'post': 'writes', 'get': 'reads'}`) that allows different rate limits per HTTP method, falling back to `throttle_scope` when no method-specific scope exists.

**Target files**: `rest_framework/throttling.py`, `rest_framework/views.py`

**Correct solution**:
1. In `ScopedRateThrottle.get_cache_key()`, after resolving `self.scope = getattr(view, 'throttle_scope', None)`, add: check `getattr(view, 'throttle_scope_map', {}).get(request.method.lower(), None)` first.
2. If a method-specific scope is found, use it; otherwise fall back to `throttle_scope`.
3. The rate lookup (`self.THROTTLE_RATES.get(self.scope)`) and cache key generation remain unchanged.

**Common mistakes without graph context**:
- Modifying `check_throttles()` in APIView instead of the throttle class itself (violating the class-based policy pattern where behavior lives in the policy class, not the view)
- Not understanding that throttle instances are created fresh per-request via `get_throttles()`, so state doesn't leak
- Breaking the `allow_request → get_cache_key → scope` chain by adding logic in the wrong place

**Graph information that helps**: The class-based-policy aspect explains that behavior belongs in policy classes, not views. The throttling node's interface.md documents the `get_cache_key` → scope resolution chain.

---

## T03: Refactor — Extract authentication execution from Request into a standalone function

**Category**: refactor

**Description**: Extract `Request._authenticate()` into a standalone `run_authentication(request)` function in the authentication module, so the authentication execution logic is co-located with the authentication classes rather than embedded in the Request class. `Request._authenticate()` should delegate to this new function.

**Target files**: `rest_framework/request.py`, `rest_framework/authentication.py`

**Correct solution**:
1. Create `run_authentication(authenticators, request)` in `authentication.py` that iterates authenticators, calls `authenticate()`, and returns `(user, auth, authenticator)` or `(None, None, None)`.
2. Modify `Request._authenticate()` to call `run_authentication(self.authenticators, self)` and unpack the result into `self.user`, `self.auth`, `self._authenticator`.
3. Crucially: the `wrap_attributeerrors()` context manager must remain in `Request._authenticate()` (not move to the standalone function) because it prevents `AttributeError` in authenticators from being swallowed by `Request.__getattr__`. The standalone function doesn't have this concern.
4. `_not_authenticated()` logic should remain in Request since it sets Request-specific attributes.

**Common mistakes without graph context**:
- Moving `wrap_attributeerrors()` into the standalone function (it's meaningless outside Request's `__getattr__` context)
- Not preserving the lazy evaluation pattern (the new function must not be called eagerly)
- Breaking the `self.user` / `self.auth` setter side effects that cache the result
- Not understanding WHY `_authenticate` lives on Request (the `WrappedAttributeError` mechanism)

**Graph information that helps**: The lazy-evaluation aspect explains why `_authenticate` is on Request and the role of `wrap_attributeerrors`. The request node's internals.md documents the `WrappedAttributeError` mechanism.

---

## T04: Cross-Module Change — Include the failed authenticator class name in NotAuthenticated responses

**Category**: cross_module

**Description**: When all authenticators fail to identify a user and a permission check then raises `NotAuthenticated`, include in the error response which authenticator classes were configured (to help API consumers debug "why am I getting 401?"). The response should include `"configured_authenticators": ["TokenAuthentication", "SessionAuthentication"]`.

**Target files**: `rest_framework/views.py`, `rest_framework/request.py`, `rest_framework/exceptions.py`

**Correct solution**:
1. In `APIView.permission_denied()`, when raising `NotAuthenticated`, include the authenticator class names. The method already has access to `request.authenticators` (used to decide 401 vs 403).
2. Modify: `raise NotAuthenticated(detail=..., configured_authenticators=[a.__class__.__name__ for a in request.authenticators])`
3. Either extend `NotAuthenticated` to accept and expose extra data, or add the info to the detail dict.
4. The exception handler in `views.py` already serializes `exc.detail` — if detail is a dict, it passes through.

**Key constraint**: Do NOT modify the authentication module itself or change the authenticate() protocol. The authenticator classes should remain unaware of error reporting. The information flows through Request (which holds the authenticator list) to APIView (which decides 401 vs 403).

**Common mistakes without graph context**:
- Modifying individual authenticator classes to report their name on failure (wrong layer)
- Not understanding the 401/403 decision logic in `permission_denied()` — the key is `request.authenticators` exists but `request.successful_authenticator` is None
- Breaking the exception serialization by using a non-serializable format
- Adding the info in `handle_exception` instead of `permission_denied` (wrong hook — `handle_exception` handles raised exceptions, `permission_denied` constructs them)

**Graph information that helps**: The flow's permission denied path explains the 401/403 distinction. The api-view interface.md documents `permission_denied()`. The authentication interface.md documents the authenticator list available on Request.

---

## T05: Constraint-Aware Change — Add caching to permission checks

**Category**: constraint_aware

**Description**: Permission checks are run on every request. Add caching so that for the same user + view + method combination, `check_permissions` returns a cached result instead of re-running all permission classes. Use Django's cache framework.

**Target files**: `rest_framework/views.py`

**Correct solution**: This change should be approached with EXTREME caution or rejected entirely. The constraints are:

1. **Permissions are stateful per-request**: Permission classes can inspect `request.data`, query parameters, headers, and other per-request state. Caching based on (user, view, method) would miss data-dependent permissions.
2. **Object permissions are per-object**: `has_object_permission` depends on the specific object being accessed. View-level caching doesn't help.
3. **Permission classes are instantiated fresh per-request** (class-based-policy aspect): they may hold per-request state in `__init__`.
4. **Operator composition**: Composed permissions (AND/OR/NOT) have complex evaluation semantics that depend on both `has_permission` and `has_object_permission` in tandem.

The correct response is to explain these constraints and either: (a) reject the change as unsafe, or (b) propose a very limited version that only caches for `AllowAny` / `IsAuthenticated` (stateless permissions) with an opt-in mechanism.

**Common mistakes without graph context**:
- Implementing a naive cache keyed on (user, view, method) without realizing permissions can depend on request body
- Not understanding that permission instances are per-request and may be stateful
- Caching at the wrong granularity (caching `has_permission` but breaking `has_object_permission`)
- Not considering the operator composition semantics — cached `has_permission` results for individual operands break OR's `has_object_permission` which re-checks `has_permission`

**Graph information that helps**: The class-based-policy aspect explains per-request instantiation. The operator-composition aspect explains OR's non-trivial `has_object_permission`. The permissions node's internals.md documents stateful permission patterns. The flow invariant states authentication → permissions → throttling ordering.
