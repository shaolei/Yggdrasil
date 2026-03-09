# Gold Standard Answers — DRF Request Processing Pipeline

## F1: Lazy properties on Request

Three properties trigger lazy evaluation:

1. **`user`** — triggers `_authenticate()`, which iterates the authenticators list. Each authenticator's `authenticate()` is called until one returns a `(user, auth)` tuple. Sets `_user`, `_auth`, and `_authenticator`.
2. **`auth`** — also triggers `_authenticate()` (same mechanism as `user`). They share the cached result.
3. **`data`** — triggers `_load_data_and_files()`, which calls `_parse()`. Uses the content negotiator to select a parser, parses the request body, and sets `_data`, `_files`, and `_full_data`.

Additionally, `successful_authenticator` and `stream` are lazy, but the three above are the primary ones. The sentinel is the `Empty` class (not `None`, because `None` is a valid value). The `_hasattr()` helper checks `getattr(obj, name) is not Empty`. Authentication uses `hasattr()` instead (checking for `_user` attribute existence).

## F2: Built-in authentication classes

1. **`BasicAuthentication`** — HTTP Basic auth. Reads `Authorization: Basic <base64(user:pass)>` header. Validates via Django's `authenticate()`.
2. **`SessionAuthentication`** — Django's session framework. Reads `request._request.user` (set by Django's session middleware). Enforces CSRF for authenticated requests.
3. **`TokenAuthentication`** — Token-based. Reads `Authorization: Token <key>` header. Looks up token in database (`authtoken.Token` model by default, customizable via `model` attribute).
4. **`RemoteUserAuthentication`** — Web server auth. Reads `REMOTE_USER` META header (configurable via `header` attribute). Delegates to Django's `RemoteUserBackend`.

## F3: SimpleRateThrottle.allow_request() algorithm

1. If `self.rate` is None, return True (throttling disabled).
2. Call `self.get_cache_key(request, view)`. If None, return True (skip throttling for this request).
3. Load `self.history` from cache using the key (default: empty list).
4. Set `self.now = self.timer()`.
5. **Sliding window cleanup**: pop entries from the end of the history list where `timestamp <= now - duration`.
6. If `len(history) >= num_requests`: call `throttle_failure()` → return False.
7. Otherwise: call `throttle_success()` → insert `now` at position 0, write history to cache with TTL = duration, return True.

## S1: Request lifecycle trace

1. Django URL router calls the view function returned by `APIView.as_view()`.
2. Django's `View.__call__` calls `APIView.dispatch(request, *args, **kwargs)`.
3. `dispatch()` stores args/kwargs on self.
4. `dispatch()` calls `self.initialize_request(request)` → creates a DRF `Request` wrapping the Django `HttpRequest`, attaching authenticators (from `get_authenticators()`), parsers (from `get_parsers()`), and content negotiator (from `get_content_negotiator()`).
5. `dispatch()` sets `self.request` and `self.headers`.
6. `dispatch()` calls `self.initial(request)`:
   a. `get_format_suffix()` — format suffix detection.
   b. `perform_content_negotiation(request)` — selects renderer and media type.
   c. `determine_version(request)` — resolves API version.
   d. `perform_authentication(request)` — accesses `request.user`, triggering `Request._authenticate()`, which iterates `Authentication` classes.
   e. `check_permissions(request)` — iterates `Permission` instances, calling `has_permission()`.
   f. `check_throttles(request)` — iterates `Throttle` instances, calling `allow_request()`.
7. `dispatch()` resolves handler: `getattr(self, request.method.lower(), self.http_method_not_allowed)`.
8. `dispatch()` calls `handler(request, *args, **kwargs)`.

## S2: Authentication state flow

1. `APIView.initialize_request()` calls `self.get_authenticators()`, which instantiates the `authentication_classes`. These instances are passed to `Request.__init__` as the `authenticators` parameter.
2. `APIView.initial()` calls `perform_authentication(request)`, which accesses `request.user`.
3. `Request.user` (property) checks `hasattr(self, '_user')`. If not set, calls `_authenticate()`.
4. `_authenticate()` iterates `self.authenticators`, calling `authenticator.authenticate(self)`. On success, sets `self._user`, `self._auth`, and `self._authenticator`.
5. When `check_permissions(request)` runs, permissions access `request.user` (already cached from step 4) and `request.auth`. The `request.successful_authenticator` is also available.
6. `APIView.permission_denied()` reads `request.authenticators` (the list) and `request.successful_authenticator` to distinguish 401 from 403: if authenticators exist but none succeeded, it raises `NotAuthenticated` (401) instead of `PermissionDenied` (403).

## S3: Permission operator composition trace

1. `IsAuthenticated & IsAdminUser` invokes `BasePermissionMetaclass.__and__` (via `OperationHolderMixin`), returning `OperandHolder(AND, IsAuthenticated, IsAdminUser)`.
2. This `OperandHolder` is set as an element in `permission_classes = [OperandHolder(AND, IsAuthenticated, IsAdminUser)]`.
3. `APIView.get_permissions()` calls `permission()` for each entry in `permission_classes`. `OperandHolder.__call__()` instantiates both operand classes and wraps them: `AND(IsAuthenticated(), IsAdminUser())`.
4. `check_permissions()` calls `permission.has_permission(request, self)` on the `AND` instance.
5. `AND.has_permission()` returns `op1.has_permission(request, view) and op2.has_permission(request, view)` — short-circuit AND.

## R1: SessionAuthentication CSRF raises PermissionDenied not AuthenticationFailed

`SessionAuthentication.enforce_csrf()` raises `PermissionDenied` with the CSRF failure reason. The downstream effect: `APIView.handle_exception()` treats `PermissionDenied` differently from `AuthenticationFailed`. `AuthenticationFailed` triggers the `WWW-Authenticate` header logic and 401 status. `PermissionDenied` goes directly to 403 with no auth header.

This makes semantic sense: the user IS authenticated (their session is valid). The CSRF failure is a request-level security issue, not an identity issue. Returning 401 would incorrectly suggest the user should re-authenticate, and would require a `WWW-Authenticate` header that doesn't apply.

Rationale: unknown — inferred from code. The choice may also prevent browsers from showing login dialogs triggered by 401 + WWW-Authenticate.

## R2: csrf_exempt in as_view() not dispatch()

The code comment states: "Views are made CSRF exempt from within `as_view` as to prevent accidental removal of this exemption in cases where `dispatch` needs to be overridden."

If `csrf_exempt` were applied inside `dispatch()`, a developer overriding `dispatch()` without calling `super().dispatch()` (or calling it incorrectly) would lose CSRF exemption. Since DRF handles its own CSRF enforcement selectively (only in `SessionAuthentication`), losing the exemption would cause Django's CSRF middleware to reject all non-GET requests, breaking token-based and basic auth.

By applying it in `as_view()`, the exemption is baked into the view function itself and cannot be accidentally removed by subclass overrides.

## R3: WrappedAttributeError mechanism

`Request` uses `__getattr__` to proxy attribute access to the underlying `_request`. Python's property/descriptor protocol interprets `AttributeError` as "this attribute doesn't exist on this object" and then falls through to `__getattr__`.

If an authenticator raises `AttributeError` (e.g., a bug accessing a model field), and this happens during `request.user` property access, Python would interpret it as "user doesn't exist on Request" and call `__getattr__('user')`, which proxies to `_request.user`. This would silently return the Django session user instead of surfacing the authenticator bug.

`wrap_attributeerrors()` catches `AttributeError` and re-raises it as `WrappedAttributeError`, which is NOT caught by the property protocol, ensuring the error surfaces correctly.

## I1: Changing authenticate() to return 3-tuple

If `authenticate()` returns `(user, auth, extra)`:

1. `Request._authenticate()` does `self.user, self.auth = user_auth_tuple` — this would raise `ValueError: too many values to unpack`.
2. ALL authentication would break. No request would successfully authenticate.
3. The `ForcedAuthentication` class also returns a 2-tuple, so test auth would break too.
4. Every custom authenticator in user code would also need updating.

The unpacking in `_authenticate()` at line `self.user, self.auth = user_auth_tuple` is the critical breakpoint.

## I2: Removing perform_authentication from initial()

If `perform_authentication(request)` is removed from `initial()`:

**Still works:**
- Authentication still happens lazily when anything accesses `request.user` or `request.auth`. So permission classes that check `request.user` (like `IsAuthenticated`) will still trigger authentication.
- `check_permissions()` would trigger authentication on first `request.user` access.

**Breaks:**
- The explicit, predictable timing guarantee is lost. Authentication errors that should surface as 401/403 before the handler runs might now surface at unpredictable points during handler execution.
- The `perform_authentication` hook itself becomes useless — developers override it to add pre-handler auth logic (e.g., logging, metrics). Without the call, those overrides are silently ignored.
- Views that don't access `request.user` in their handler or permissions would never authenticate at all.

## I3: Counter instead of timestamp list

If `SimpleRateThrottle` used a counter with TTL instead of timestamps:

1. **wait() calculation breaks** — `wait()` uses `self.history[-1]` (oldest timestamp) to compute remaining duration. A counter has no timing information for individual requests.
2. **Sliding window degrades to fixed window** — a counter with TTL creates a fixed window. A client could make N requests at 11:59:59 (exhausting the window), wait 1 second for the counter to reset, then make N more at 12:00:00. The sliding window prevents this by tracking individual request times.
3. **Burst-at-boundary vulnerability** — effectively allows 2N requests in a 2-second span around the window boundary.

## C1: DjangoObjectPermissions returning 403 instead of 404

If 403 were returned instead of 404 when the user lacks read permissions:

1. **Information leakage**: an unauthorized user could enumerate which objects exist by attempting to access them. A 403 confirms "this object exists but you can't access it." A 404 is ambiguous — could mean the object doesn't exist OR you can't see it.
2. **Enumeration attacks**: an attacker could iterate IDs (e.g., `/api/users/1/`, `/api/users/2/`, ...) and distinguish existing from non-existing objects.
3. This is a standard security pattern used by GitHub's API and others.

## C2: Eager authentication in Request.__init__

If `Request.__init__` eagerly called `_authenticate()`:

1. **Performance degradation**: every request would pay the authentication cost, even views that don't need it (e.g., public endpoints with `AllowAny`).
2. **Breaks `perform_authentication` override pattern**: the code comment on `perform_authentication` says: "if you override this and simply 'pass', then authentication will instead be performed lazily." Eager init authentication removes this flexibility.
3. **Breaks initialization order**: `initialize_request()` creates the Request before `initial()` runs. If authentication happens in `__init__`, it runs before content negotiation and version determination. Authenticators that depend on the version or accepted renderer would fail.
4. **Exception handling context not ready**: during `__init__`, the view's `self.request` is not yet set (set in `dispatch()` after `initialize_request()`). If authentication raises, `handle_exception` may not have the full context.

## C3: OR.has_object_permission naive implementation

If `OR.has_object_permission()` simply returned `op1.has_object_permission() or op2.has_object_permission()`:

Consider `permission_classes = [IsAuthenticated | IsProjectMember]`:

- `IsAuthenticated.has_permission()` → True (user is logged in)
- `IsAuthenticated.has_object_permission()` → True (default BasePermission implementation)
- `IsProjectMember.has_permission()` → False (user is not a project member)
- `IsProjectMember.has_object_permission()` → False (user lacks project access)

**Naive OR**: `True or False = True` — access granted even though the user isn't a project member.

**Correct implementation**: checks `(op1.has_permission AND op1.has_object_permission) OR (op2.has_permission AND op2.has_object_permission)`. This means: "the first operand must fully pass (view + object level) OR the second operand must fully pass." Result: `(True AND True) OR (False AND False)` = True — which in this specific case still passes, but consider the reverse: if `IsProjectMember.has_permission()` returns True but `has_object_permission()` returns False, the naive approach would still pass via op1's default True, while the correct approach properly fails op2 and relies on op1.

The key scenario: when one operand's `has_object_permission()` should fail but the other operand's default `True` from `BasePermission` would incorrectly rescue it. The correct implementation ensures that object-level permissions are only considered for operands whose view-level permission also passed.
