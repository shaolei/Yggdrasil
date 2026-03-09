# Auth Endpoints — Internals

## Logic

### Cookie handling pattern

All endpoints that issue tokens follow the same pattern:
1. Call the operation to get a result with `token`
2. Call `generatePayloadCookie` with the token and collection auth config
3. If `removeTokenFromResponses` is enabled, delete token from JSON body
4. Set the `Set-Cookie` header on the response

Logout uses `generateExpiredPayloadCookie` (sets expiry to 1 second in the past) to clear the cookie.

### Login credential extraction

The login handler conditionally includes `username` in the auth data based on `loginWithUsername` config. If `loginWithUsername !== false`, username is extracted from the request body.

### All endpoints use wrapInternalEndpoints

Both `authRootEndpoints` and `authCollectionEndpoints` arrays are wrapped via `wrapInternalEndpoints`, which marks them as internal Payload endpoints (as opposed to custom user-defined endpoints).

## Decisions

- Chose to always return success message for forgot-password over indicating user existence — rationale: security, prevents email enumeration (enforced at operation level, endpoint is just a passthrough)
- Chose `Set-Cookie` header over returning token only in body — rationale: unknown — inferred from code, but HttpOnly cookies are standard security practice preventing XSS-based token theft
