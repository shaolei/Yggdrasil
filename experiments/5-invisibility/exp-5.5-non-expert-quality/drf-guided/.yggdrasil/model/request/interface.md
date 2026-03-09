# Request — Interface

## Constructor

### Request(request, parsers=None, authenticators=None, negotiator=None, parser_context=None)
Wraps a Django `HttpRequest`. Asserts the input is an `HttpRequest` instance. Detects forced authentication from test client.

## Properties (Lazy)

### user (property)
Returns the authenticated user. Triggers `_authenticate()` on first access. Settable — also sets user on the underlying Django request for middleware compatibility.

### auth (property)
Returns non-user auth info (e.g., token). Triggers `_authenticate()` on first access.

### successful_authenticator (property)
Returns the authenticator instance that succeeded, or `None`.

### data (property)
Returns parsed request body. Triggers `_load_data_and_files()` on first access. Merges file data.

### query_params (property)
Alias for `self._request.GET`.

### content_type (property)
Returns Content-Type from request META.

### stream (property)
Returns request body stream. Handles edge cases: zero content length, already-read body.

## Methods

### force_plaintext_errors(value)
Hack to force plaintext vs HTML error rendering in debug mode.

## Attribute Proxying
`__getattr__` delegates unknown attributes to the wrapped `_request`, enabling transparent access to Django request attributes.

## Failure Modes
- `UnsupportedMediaType` (415) — no parser matches the Content-Type
- `ParseError` (400) — parser fails to parse the body
- `AuthenticationFailed` (401) — authenticator raises during lazy auth
- `WrappedAttributeError` — re-raised `AttributeError` from auth to prevent silent swallowing by Python's attribute protocol
