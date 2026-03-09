# Pluggable Policy Pattern

## What

Every policy type (authentication, permissions, throttling, content negotiation, rendering, parsing) follows the same pattern:

1. A class-level attribute holds a list of policy classes (e.g., `authentication_classes`, `permission_classes`).
2. Defaults come from `api_settings.DEFAULT_*` settings.
3. A `get_*()` method instantiates the classes per-request (e.g., `get_authenticators()` returns `[auth() for auth in self.authentication_classes]`).
4. Views can override the class-level attribute to customize behavior per-view.
5. The `settings` attribute on `APIView` is injected, making testing easier.

## Why

This pattern enables DRF's core value proposition: a batteries-included framework where every aspect of request handling is customizable without subclassing the view. Users configure globally via settings or per-view via class attributes.

Rationale: unknown — inferred from code and the framework's design philosophy. The git history shows this pattern was established in the earliest commits and has remained stable.

## Constraints

- Policy classes are instantiated fresh per request (not shared across requests).
- The content negotiator is cached on the view instance (`_negotiator`) — this is an exception to the per-request instantiation rule.
