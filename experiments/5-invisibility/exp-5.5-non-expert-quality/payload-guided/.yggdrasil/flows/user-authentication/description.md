# User Authentication Flow

## Business Context

Users authenticate to access Payload CMS resources. Authentication supports multiple mechanisms: local credentials (email/username + password), JWT tokens, API keys, and custom strategies. The system enforces brute force protection, email verification, and session management.

## Trigger

User sends a login request with credentials, or makes any authenticated request.

## Goal

Establish the user's identity and attach it to the request (`req.user`) for downstream access control decisions.

## Participants

- **Auth Operations**: orchestrates login/logout/refresh lifecycle with hooks and transactions
- **Auth Strategies**: verifies identity via JWT, API key, or local password
- **Sessions**: manages session creation, extension, and revocation on the user document
- **JWT**: signs tokens and extracts them from HTTP requests
- **Cookies**: generates auth cookies with security attributes
- **Fields To Sign**: selects which user fields to embed in the JWT
- **Access Control**: evaluates per-operation access using configured functions
- **Entity Permissions**: builds full permission maps for collections and globals

## Paths

### Happy Path — Login

1. User submits email/username + password
2. System validates input and looks up user (excluding trashed)
3. System verifies user is not locked
4. System verifies password (pbkdf2, 25k iterations, timing-safe comparison)
5. System checks email verification (if required)
6. System creates session on user document
7. Hooks run (beforeLogin, afterLogin, afterRead)
8. System signs JWT with user fields
9. Cookie is generated with the token
10. Token, expiration, and user data returned

### Happy Path — Subsequent Request

1. Strategy pipeline runs on incoming request
2. JWT extracted from cookie/header (configurable order, CSRF check for cookies)
3. JWT signature verified
4. User looked up by ID from JWT claims
5. Session validated (if sessions enabled)
6. `req.user` set for downstream operations

### Failure — Invalid Credentials

1. Password verification fails
2. Login attempts incremented (outside transaction for parallel visibility)
3. If max attempts reached: account locked, recent sessions purged (20s window)
4. AuthenticationError thrown

### Failure — Account Locked

1. User exists but `lockUntil` is in the future
2. LockedAuth error thrown immediately (before password check)

## Invariants Across All Paths

- Password verification ALWAYS happens before session creation
- Transaction only starts after successful authentication
- `updatedAt` is never modified by session-only changes
- Failed strategies are logged but never block subsequent strategies in the pipeline
- The `_strategy` field on the user always reflects which strategy authenticated them
