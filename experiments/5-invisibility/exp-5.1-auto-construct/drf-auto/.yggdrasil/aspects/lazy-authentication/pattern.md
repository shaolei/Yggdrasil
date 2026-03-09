# Lazy Authentication

## What

Authentication is not performed when the Request object is created. Instead, authentication occurs on first access to `request.user` or `request.auth` properties. The `APIView.perform_authentication()` method forces eager authentication by accessing `request.user`.

The `APIView.initial()` method calls `perform_authentication()` to ensure authentication happens before permission and throttle checks. However, views can override `perform_authentication()` to `pass`, deferring authentication to the first property access.

## Why

The code comment in `perform_authentication()` explicitly states: "if you override this and simply 'pass', then authentication will instead be performed lazily, the first time either `request.user` or `request.auth` is accessed."

This design allows views that don't need user information to skip authentication entirely, or to defer it until a specific point in the request lifecycle.

## Constraints

- `wrap_attributeerrors()` context manager is used during authentication to prevent `AttributeError` during authentication from being silently caught by the attribute access protocol on the Request proxy.
- Unauthenticated requests default to `AnonymousUser` (via `UNAUTHENTICATED_USER` setting) and `None` auth token (via `UNAUTHENTICATED_TOKEN` setting).
