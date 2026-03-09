# Class-Based Policy Configuration

## What

Every request processing concern (authentication, permissions, throttling, content negotiation) is represented as a swappable list of classes on the view. The view declares *which* policy classes to use via class attributes (e.g., `authentication_classes`, `permission_classes`, `throttle_classes`). Corresponding `get_*()` factory methods instantiate these classes fresh per-request.

## Why

This pattern enables per-view override of any policy without subclassing the entire view. A developer can change authentication for a single endpoint by setting `authentication_classes = [TokenAuthentication]` on that view class. Global defaults are set via `api_settings.DEFAULT_*_CLASSES`, providing a single configuration point for project-wide behavior.

## Rules

1. Policy classes are stored as class attributes referencing class objects (not instances).
2. Instantiation happens per-request via `get_authenticators()`, `get_permissions()`, `get_throttles()`, etc.
3. Global defaults come from `api_settings` and can be overridden at the class level or even dynamically by overriding the `get_*()` methods.
4. The ordered execution sequence in `initial()` is fixed: authentication → permissions → throttling. This order is mandatory because permissions depend on the authenticated user, and throttling may depend on both.
