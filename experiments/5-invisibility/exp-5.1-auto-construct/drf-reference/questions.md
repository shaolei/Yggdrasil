# Diagnostic Questions — DRF Request Processing Pipeline

## Factual

**F1**: What are the three properties on the `Request` class that trigger lazy evaluation, and what does each trigger?

**F2**: What are all the built-in authentication classes, and what credential source does each use?

**F3**: How does `SimpleRateThrottle.allow_request()` decide whether to allow or deny a request? Describe the algorithm step by step.

## Structural

**S1**: Trace the complete sequence of method calls from when Django routes a request to an `APIView` until the handler method (e.g., `get`) is called. Include which classes are involved at each step.

**S2**: How does authentication state flow from the `Authentication` module through `Request` to `APIView.check_permissions()`? What specific attributes are set and read?

**S3**: How do the `&` and `|` operators on permission classes work? Trace from `IsAuthenticated & IsAdminUser` being set as a `permission_classes` entry through to `check_permissions()` calling `has_permission()`.

## Rationale

**R1**: Why does `SessionAuthentication.enforce_csrf()` raise `PermissionDenied` instead of `AuthenticationFailed`? What downstream effect does this distinction have?

**R2**: Why does `APIView.as_view()` apply `csrf_exempt` rather than doing it in `dispatch()`? What problem does this prevent?

**R3**: Why does the `Request` class use a `WrappedAttributeError` mechanism? What specific bug does it prevent?

## Impact

**I1**: What breaks if you change `BaseAuthentication.authenticate()` to return a 3-tuple `(user, auth, extra)` instead of a 2-tuple?

**I2**: What happens if you remove the `self.perform_authentication(request)` call from `APIView.initial()`? Which parts of the system still work and which break?

**I3**: If you change `SimpleRateThrottle` to store a counter instead of a list of timestamps, what functionality is lost?

## Counterfactual

**C1**: What would go wrong if `DjangoObjectPermissions` returned 403 instead of 404 when the user lacks read permissions on an object?

**C2**: What would happen if `Request.__init__` eagerly called `_authenticate()` instead of deferring to the `user` property?

**C3**: Why doesn't `OR.has_object_permission()` simply return `op1.has_object_permission() or op2.has_object_permission()`? What specific scenario would break?
