# Request — Internals

## Logic

### Authentication Flow (`_authenticate`)
Iterates `self.authenticators` in order. Each authenticator's `authenticate()` is called:
- Returns `(user, auth)` tuple → sets `_user`, `_auth`, `_authenticator`, returns.
- Returns `None` → try next authenticator.
- Raises `APIException` → calls `_not_authenticated()` first, then re-raises.

If no authenticator succeeds, `_not_authenticated()` sets defaults from `UNAUTHENTICATED_USER` (default: `AnonymousUser`) and `UNAUTHENTICATED_TOKEN` (default: `None`).

### Data Parsing Flow (`_load_data_and_files`)
1. Calls `_parse()` to get `(data, files)`.
2. If files exist, `_full_data` is a copy of data merged with files.
3. For form media types, copies data/files refs to the underlying HttpRequest so closable objects are handled appropriately (commit `6d4d4dfd` #5262).

### Stream Handling (`_load_stream`)
- Content-Length 0 → stream is None.
- Request body not yet read → stream is the request itself.
- Body already read → wraps `self.body` in `io.BytesIO`.

Fallback for `RawPostDataException` (commit `be74d111` #4500): if `request.POST` was accessed in middleware for a multipart POST, the stream is exhausted. If the request supports form parsing, falls back to `self._request.POST` and `self._request.FILES`.

### Attribute Proxy (`__getattr__`)
Proxies attribute access to `self._request` (the Django HttpRequest). Commit `1a667f42` (#5617) reimplemented this to use `__getattribute__` for `_request` lookup to avoid infinite recursion. Commit `d507cd85` (#8684) fixed infinite recursion with `deepcopy` on Request.

### `WrappedAttributeError`
`wrap_attributeerrors()` context manager catches `AttributeError` during authentication/parsing and re-raises as `WrappedAttributeError`. This prevents the `__getattr__` proxy from silently catching `AttributeError`s that occur during authentication and treating them as missing attributes. Commit `c63e35cb` (#5600): "Fix AttributeError hiding on request authenticators."

## Decisions

- **`Empty` sentinel class**: `None` cannot be used as "unset" marker because `None` is a valid value for parsed data. The `Empty` class serves as a sentinel. `_hasattr()` checks against `Empty` instead of using Python's `hasattr()`.
- **User setter sets on both Request and HttpRequest**: Comment: "This is necessary to maintain compatibility with django.contrib.auth where the user property is set in the login and logout functions." Also: "ensuring that it is available to any middleware in the stack."
- **`force_plaintext_errors`**: Comment: "Hack to allow our exception handler to force choice of plaintext or html error responses." Sets `_request.is_ajax` to a lambda returning the boolean value.
