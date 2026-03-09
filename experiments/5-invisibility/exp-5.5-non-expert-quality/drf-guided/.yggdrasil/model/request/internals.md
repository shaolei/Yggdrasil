# Request — Internals

## Logic

### Authentication Pipeline (_authenticate)
Iterates authenticators in order:
- Returns `(user, token)` tuple → sets `_user`, `_auth`, `_authenticator`, stops
- Returns `None` → "not my scheme", try next
- Raises `APIException` → calls `_not_authenticated()` (sets AnonymousUser), then re-raises
- No authenticator matches → calls `_not_authenticated()` (defaults to AnonymousUser)

### Lazy Evaluation Mechanism
Uses `Empty` sentinel (not `None`, since `None` is a valid value). `_hasattr` checks if attribute is still `Empty`. First access triggers computation and caches result.

### Parse Error Recovery
On parse exception, `_data`, `_files`, `_full_data` are set to empty values BEFORE re-raising. This prevents repeated parse attempts when rendering error responses in the browsable API.

## Constraints

- `wrap_attributeerrors()` context manager MUST be used around `_authenticate()` and `_load_data_and_files()`. Without it, `AttributeError` raised inside authentication code would be silently caught by Python's descriptor protocol (since these are called from `@property` getters), making debugging impossible.

## Decisions

- **Wrapper over subclass**: Chose composition (wrapping HttpRequest) over inheritance (subclassing HttpRequest). Wrapper gives full API control while `__getattr__` provides transparent fallback to Django's request. Rationale: unknown — this predates current team. Likely because DRF needs to override `POST` and `data` behavior which would conflict with Django's HttpRequest internals.

- **Empty sentinel over None**: Chose `Empty` class over `None` for "unset" state because `None` is a valid authentication result (no user). Rationale: correctness — using `None` would make it impossible to distinguish "not yet computed" from "computed and found no user."
