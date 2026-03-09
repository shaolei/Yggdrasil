# Request — Internals

## Logic

### Authentication sequence (`_authenticate`)

Iterates `self.authenticators` in order. Each authenticator's `authenticate(self)` is called:
- Returns `(user, auth)` tuple → sets `_user`, `_auth`, `_authenticator`, and stops.
- Returns `None` → tries the next authenticator.
- Raises `APIException` → calls `_not_authenticated()` (sets defaults) then re-raises.

If all authenticators return None, calls `_not_authenticated()` which sets user to `UNAUTHENTICATED_USER()` (default: `AnonymousUser`) and auth to `UNAUTHENTICATED_TOKEN()` (default: None).

### Parsing sequence (`_parse`)

1. Gets content type and stream.
2. If stream has already been read (`RawPostDataException`), falls back to `_request.POST` and `_request.FILES` for form types.
3. If stream is None or content type is None, returns empty data (form-aware: `QueryDict` for form types, `{}` otherwise).
4. Uses content negotiator to select a parser.
5. Calls `parser.parse(stream, media_type, parser_context)`.
6. On parse error: fills `_data`, `_files`, `_full_data` with empty values BEFORE re-raising. This prevents double-parse errors during error response rendering.
7. Unpacks result: either a `DataAndFiles` object or raw parsed data.

### Sentinel pattern

Uses an `Empty` class (not `None`) as the sentinel for unset attributes, because `None` is a valid value for stream, data, etc. The `_hasattr()` helper checks `getattr(obj, name) is not Empty`.

### Form data back-sync

After parsing form data, copies `_data` and `_files` back to `_request._post` and `_request._files`. This ensures Django middleware that accesses `request.POST` after DRF parsing sees the correct data.

## State

- `_user`, `_auth`, `_authenticator` — set by `_authenticate()`, cached.
- `_data`, `_files`, `_full_data` — set by `_load_data_and_files()`, cached.
- `_stream` — set by `_load_stream()`, cached.
- All start as `Empty` sentinel.

## Decisions

### Empty sentinel class over None — rationale: inferred from code comment

Chose a dedicated `Empty` class over `None` because `None` is a valid value for these attributes (e.g., stream can legitimately be None for zero-content-length requests).

### WrappedAttributeError over bare AttributeError — rationale: observable from code comment

Chose to wrap `AttributeError` in a `WrappedAttributeError` because Python's descriptor/property protocol interprets `AttributeError` as "attribute doesn't exist" and silently falls through to `__getattr__`. Since `Request.__getattr__` proxies to `_request`, an authentication `AttributeError` would be silently swallowed and proxied instead of raised.

### Fill empty data before re-raising parse errors — rationale: observable from code comment

Chose to fill `_data`, `_files`, `_full_data` with empty values before re-raising parse errors, over leaving them as `Empty`, because the browsable API renderer or logging may attempt to access `request.data` during error response rendering, which would trigger another parse attempt and a confusing double error.

### ForcedAuthentication replaces authenticators — rationale: inferred from code

When `_force_auth_user` or `_force_auth_token` is set on the underlying request, the constructor replaces the entire `authenticators` tuple with a single `ForcedAuthentication` instance. This ensures test-forced auth takes absolute precedence over any configured authenticators.
