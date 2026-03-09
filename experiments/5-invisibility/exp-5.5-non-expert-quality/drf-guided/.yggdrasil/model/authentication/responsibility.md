# Authentication

Provides pluggable authentication policies for identifying the user making a request.

## Responsibilities

- Defining the `BaseAuthentication` interface (`authenticate`, `authenticate_header`)
- Providing built-in authentication schemes: BasicAuthentication, SessionAuthentication, TokenAuthentication, RemoteUserAuthentication
- Extracting credentials from request headers (Authorization header parsing)
- Returning `(user, auth_info)` tuples on success, `None` on "not my scheme", or raising `AuthenticationFailed`
- Providing `authenticate_header()` values for WWW-Authenticate response headers (determines 401 vs 403 behavior)

## NOT Responsible For

- Deciding WHEN authentication runs (controlled by APIView and Request)
- Permission or authorization decisions
- User model management
- Token generation or storage (TokenAuthentication only reads tokens)
