# Lazy Evaluation of Request Properties

## What

The `Request` class uses Python properties with sentinel values (`Empty` class) to defer computation until first access. The `user`, `auth`, and `data` properties trigger authentication or parsing only when accessed. Authentication is triggered by accessing `request.user` or `request.auth`; parsing is triggered by accessing `request.data`.

## Why

This avoids unnecessary work. A view that does not need the request body (e.g., a DELETE endpoint) never triggers parsing. A view that overrides `perform_authentication` to `pass` defers authentication to the first `request.user` access.

## Rules

1. The `Request.__init__` method must NOT call `_authenticate()` or `_parse()`.
2. Properties use `_hasattr` / `hasattr` checks against sentinel values to determine if computation has occurred.
3. `wrap_attributeerrors()` is used around lazy evaluation to prevent `AttributeError` during authentication from being swallowed by Python's attribute access protocol (which interprets `AttributeError` as "attribute does not exist").
4. `perform_authentication(request)` in `APIView.initial()` forces eager evaluation by accessing `request.user`, but this can be overridden.
