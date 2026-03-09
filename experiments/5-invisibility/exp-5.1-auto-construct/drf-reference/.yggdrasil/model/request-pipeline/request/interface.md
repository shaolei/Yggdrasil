# Request — Interface

## Constructor

### `Request(request, parsers=None, authenticators=None, negotiator=None, parser_context=None)`

- `request` — Django `HttpRequest` instance (assertion enforced)
- `parsers` — list of parser instances (default: empty tuple)
- `authenticators` — list of authenticator instances (default: empty tuple)
- `negotiator` — content negotiation instance (default: from `api_settings`)
- `parser_context` — dict passed to parsers, auto-populated with `request` and `encoding`

If the underlying `HttpRequest` has `_force_auth_user` or `_force_auth_token` attributes (set by DRF test utilities), authenticators are replaced with a `ForcedAuthentication` instance.

## Properties

### `user → User | AnonymousUser | None`

The authenticated user. Triggers `_authenticate()` on first access. If no authenticator succeeds, defaults to `UNAUTHENTICATED_USER()` (typically `AnonymousUser`). Settable — also sets `_request.user` for Django middleware compatibility.

### `auth → token | None`

The authentication token/credential. Triggers `_authenticate()` on first access. Settable.

### `successful_authenticator → BaseAuthentication | None`

The authenticator instance that successfully authenticated the request, or None.

### `data → dict | QueryDict`

Parsed request body. Triggers `_load_data_and_files()` on first access. Includes merged file data if present.

### `query_params → QueryDict`

Alias for `_request.GET`. Provided for semantic clarity.

### `content_type → str`

From `CONTENT_TYPE` or `HTTP_CONTENT_TYPE` META header.

### `stream → file-like | None`

Request body stream. None if content length is 0. Falls back to `io.BytesIO(self.body)` if the raw stream has already been read.

### `POST → QueryDict`

For form media types, returns parsed data. For non-form types, returns empty QueryDict. Ensures compatibility with code expecting Django's `request.POST`.

### `FILES → MultiValueDict`

Parsed file uploads.

## Attribute Proxy

`__getattr__` proxies attribute access to the underlying `_request`, making `Request` a transparent wrapper. This means `request.META`, `request.session`, etc. work without explicit delegation.

## Module-Level Utilities

### `clone_request(request, method) → Request`

Creates a copy of a Request with a different HTTP method. Used by the browsable API to check permissions for different methods. Copies parsed data, auth state, and negotiation results.

### `override_method(view, request, method)` — context manager

Temporarily overrides the request's method on a view. Used for the browsable API's method switching.

### `wrap_attributeerrors()` — context manager

Re-raises `AttributeError` as `WrappedAttributeError` to prevent Python's attribute access protocol from swallowing authentication errors.

### `is_form_media_type(media_type) → bool`

Returns True for `application/x-www-form-urlencoded` and `multipart/form-data`.

## Failure Modes

| Scenario | Exception | Notes |
|---|---|---|
| `request` arg is not HttpRequest | `AssertionError` | Constructor validation |
| No parser for content type | `UnsupportedMediaType` | During `_parse()` |
| Parser raises error | Re-raised after filling empty data | Prevents double-parse on error rendering |
| Authentication fails | `APIException` subclass | `_not_authenticated()` called before re-raise |
