# Authentication — Responsibility

## Identity

Provides pluggable authentication policies for identifying the user making an API request. Defines the `BaseAuthentication` base class and ships four built-in implementations: `BasicAuthentication`, `SessionAuthentication`, `TokenAuthentication`, and `RemoteUserAuthentication`.

## Boundaries

**Responsible for:**
- Defining the authenticator interface (`authenticate()`, `authenticate_header()`)
- Extracting credentials from HTTP headers (Authorization, cookies, REMOTE_USER)
- Validating credentials against Django's auth system
- Enforcing CSRF for session-based authentication
- Providing the WWW-Authenticate header value for 401 responses

**NOT responsible for:**
- Deciding when authentication occurs (controlled by Request and APIView)
- Authorization/permission decisions (delegated to permissions module)
- Token model/storage (delegated to `rest_framework.authtoken.models`)
- OAuth authentication (removed to separate package per commit `baa518cd` #1767)
