# Auth Endpoints

## Identity

HTTP request handlers that expose auth operations as REST endpoints. Thin translation layer between HTTP and the auth operations layer.

## Responsibilities

- Parse HTTP request data (query params, body) into operation arguments
- Invoke the corresponding auth operation
- Generate HTTP responses with appropriate status codes, headers (CORS), and cookies
- Set/clear auth cookies on login, refresh, and logout
- Optionally remove token from response body (`removeTokenFromResponses` config)

## Not Responsible For

- Business logic (all delegated to operations)
- Input validation beyond basic type coercion (operations handle validation)
- Authentication/authorization of the endpoint itself (handled by middleware)
- Hook execution (handled by operations)

## Endpoints

Two registration groups:
1. **Root endpoints**: `GET /access` (permissions introspection)
2. **Collection endpoints** (mounted per auth-enabled collection):
   - `POST /login`
   - `POST /logout`
   - `POST /refresh-token`
   - `POST /forgot-password`
   - `POST /reset-password`
   - `POST /first-register`
   - `POST /unlock`
   - `POST /verify/:id`
   - `GET /init`
   - `GET /me`

All endpoints are wrapped via `wrapInternalEndpoints`.
