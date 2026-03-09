# Request

Wrapper around Django's `HttpRequest` that provides a richer API for REST framework views.

## Responsibilities

- Wrapping the underlying Django `HttpRequest` and proxying unknown attribute access to it via `__getattr__`
- Lazy authentication: `request.user` and `request.auth` trigger `_authenticate()` on first access, then cache the result
- Lazy content parsing: `request.data` triggers parsing on first access via `_load_data_and_files()`
- Content type detection and stream management for request body parsing
- Holding references to authenticators, parsers, and negotiator instances (injected by APIView)
- Supporting forced authentication for testing (`ForcedAuthentication`)
- Supporting request cloning (`clone_request`) for permission checking with different HTTP methods

## NOT Responsible For

- Authentication logic (delegated to authenticator instances)
- Parsing logic (delegated to parser instances)
- Permission or throttle checking
- Response handling
