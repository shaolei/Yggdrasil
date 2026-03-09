# Policy Pattern

Authentication, permissions, and throttling all follow the same structural pattern:

1. **Base class** defines an abstract interface (e.g., `BaseAuthentication.authenticate`, `BasePermission.has_permission`, `BaseThrottle.allow_request`)
2. **Class attribute on APIView** holds a list of policy classes (not instances): `authentication_classes`, `permission_classes`, `throttle_classes`
3. **Getter method on APIView** instantiates them per-request: `get_authenticators()`, `get_permissions()`, `get_throttles()`
4. **Enforcement method on APIView** iterates the instances and applies the policy: `perform_authentication()`, `check_permissions()`, `check_throttles()`

## Why This Pattern

Allows swapping security behavior at the view level without modifying view logic. Policies can be configured globally via settings or per-view via class attributes.

## Variation: Iteration Strategy

- **Authentication**: first-match-wins. First authenticator returning a tuple wins. `None` means "not my scheme, try next." Exception stops the chain.
- **Permissions**: all-must-pass with short-circuit. First permission returning `False` stops and denies.
- **Throttling**: collect-all. All throttles are checked; failures are collected and the maximum wait time is reported.
