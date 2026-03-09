# User Login

## Business context

A user (human or API consumer) authenticates against a Payload CMS collection to obtain a session. Payload supports multiple auth-enabled collections, each with independent configuration for login methods, token expiration, and session management.

## Trigger

HTTP POST to `/<collection-slug>/login` with credentials (email/username + password).

## Goal

Verify the user's identity and issue a JWT token (and optionally a server-side session) that grants authenticated access to protected resources.

## Participants

- **Auth Endpoints** — receives HTTP request, extracts credentials, delegates to operation, generates cookie from token
- **Auth Operations** — orchestrates the login business logic: input validation, user lookup, password verification, brute-force tracking, session creation, JWT signing, hook execution
- **Auth Infrastructure** — provides password verification (local strategy), JWT signing, session management, cookie generation

## Paths

### Happy path

1. User submits email/username and password to the login endpoint
2. System validates required fields based on collection's `loginWithUsername` config
3. System looks up user by email/username (excluding trashed users)
4. System checks user is not locked
5. System verifies password using local strategy (pbkdf2 + timingSafeEqual)
6. If email verification is enabled and user is unverified, reject
7. System starts a transaction
8. System re-checks lock status (parallel safety)
9. System creates a server-side session (if sessions enabled)
10. System collects JWT fields from user (respecting `saveToJWT` field config)
11. System resets login attempts counter
12. System runs `beforeLogin` hooks
13. System signs JWT with HS256
14. System runs `afterLogin` hooks, `afterRead` field hooks, collection `afterRead` hooks
15. System commits transaction
16. Endpoint generates HttpOnly cookie with token and returns response

### Failed password path

1. Steps 1-4 same as happy path
2. Password verification fails
3. If brute-force protection enabled: increment login attempts (outside transaction for parallel visibility)
4. If max attempts reached: lock account, revoke recent sessions (20-second window)
5. Re-check login permission (may throw LockedAuth)
6. Throw AuthenticationError

### Error recovery

- If any error occurs after session creation, the session is explicitly revoked
- Transaction is killed on any error
- Login attempt increment is NOT rolled back (intentional — parallel safety)

## Invariants across all paths

- Password comparison always uses timing-safe comparison
- Trashed users are always excluded from lookup
- Email/username inputs are always lowercased and trimmed
- Login attempt tracking operates outside the request transaction
- The `_strategy` field on the user is always set to `'local-jwt'`
