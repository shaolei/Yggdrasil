# Request — Interface

## Constructor

### `Request(request, parsers=None, authenticators=None, negotiator=None, parser_context=None)`
- `request` must be a `django.http.HttpRequest` instance (assertion enforced).
- If `_force_auth_user` or `_force_auth_token` is set on the underlying request, authenticators are replaced with `ForcedAuthentication`.

## Properties

### `request.data` -> dict | QueryDict
Parsed request body. Triggers `_load_data_and_files()` on first access. Merges data and files for form media types.

### `request.query_params` -> QueryDict
Alias for `request._request.GET`. Semantically clearer name.

### `request.user` -> User | AnonymousUser
Authenticated user. Triggers `_authenticate()` on first access. Setter also sets user on the underlying Django request for middleware compatibility.

### `request.auth` -> object | None
Authentication token/credentials. Triggers `_authenticate()` on first access.

### `request.successful_authenticator` -> BaseAuthentication | None
The authenticator instance that successfully authenticated the request.

### `request.content_type` -> str
Content type from request META headers.

### `request.stream` -> file-like | None
Request body as a stream. Handles already-read body by falling back to `io.BytesIO(self.body)`.

### `request.POST` -> QueryDict
For form media types, returns parsed data. For non-form types, returns empty QueryDict.

### `request.FILES` -> MultiValueDict
Parsed file uploads.

## Functions

### `clone_request(request, method) -> Request`
Creates a copy of a Request with a different HTTP method. Preserves parsed data, auth state, versioning info. Used for checking permissions on alternative methods in the browsable API.

### `override_method(view, request, method)` (context manager)
Temporarily changes the request method on a view. Also sets `view.action` from `action_map`.

### `is_form_media_type(media_type) -> bool`
Returns True for `application/x-www-form-urlencoded` or `multipart/form-data`.

## Failure Modes

- Non-HttpRequest passed to constructor → `AssertionError`
- Unsupported media type → `UnsupportedMediaType` exception
- Parse error → `ParseError` exception (data fields set to empty before re-raise, per commit `c1d9a96d`)
- `AttributeError` during authentication → re-raised as `WrappedAttributeError` to prevent silent swallowing by `__getattr__` proxy
