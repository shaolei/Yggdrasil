# API Request Processing

## Business Context

When a client makes an HTTP request to a REST API endpoint, the system must identify the caller, verify they are authorized, ensure they are not exceeding rate limits, and then execute the requested operation. This is the core request lifecycle of Django REST Framework.

## Trigger

An HTTP request arrives at a URL routed to an APIView subclass.

## Goal

Execute the appropriate handler method and return a well-formed response, or deny the request with an appropriate error code and headers.

## Participants

- **APIView** — orchestrates the pipeline, dispatches to handler
- **Request** — wraps Django's HttpRequest, provides lazy auth and content parsing
- **Authentication** — identifies the user from credentials
- **Permissions** — determines if the identified user may perform the action
- **Throttling** — enforces rate limits

## Paths

### Happy Path

1. Django routes request to APIView.dispatch()
2. dispatch() wraps the raw request in a DRF Request (initialize_request)
3. initial() runs the pre-handler pipeline:
   a. Content negotiation determines response format
   b. API versioning determined
   c. Authentication: request.user accessed, triggering authenticator chain. One authenticator returns (user, auth).
   d. Permissions: all permission classes checked, all return True
   e. Throttling: all throttle classes checked, all allow the request
4. Handler method executes (e.g., get(), post())
5. finalize_response() attaches renderer and headers
6. Response returned to client

### Authentication Failure

- Authenticator raises AuthenticationFailed
- handle_exception() checks for WWW-Authenticate header
- If header exists: 401 response with WWW-Authenticate
- If no header (e.g., session auth): coerced to 403

### Permission Denial

- Permission returns False
- If user is not authenticated (authenticators exist but none succeeded): 401 NotAuthenticated
- Otherwise: 403 PermissionDenied
- DjangoObjectPermissions: 404 if user lacks read permission (prevents information leakage)

### Throttle Exceeded

- Throttle returns False (allow_request)
- All throttles are checked (not short-circuited)
- 429 response with Retry-After header set to maximum wait time

### Unhandled Exception

- Exception handler returns None
- Exception re-raised as 500
- If ATOMIC_REQUESTS enabled: database transaction rolled back via set_rollback()

## Invariants Across All Paths

- Authentication always runs before permissions (permissions depend on request.user)
- Permissions always run before throttles (avoid wasting throttle budget on denied requests)
- Content negotiation runs before security checks (error responses need to know response format)
- All handled exceptions produce API-formatted responses (not Django HTML error pages)
- Database rollback occurs on any handled exception when ATOMIC_REQUESTS is enabled
