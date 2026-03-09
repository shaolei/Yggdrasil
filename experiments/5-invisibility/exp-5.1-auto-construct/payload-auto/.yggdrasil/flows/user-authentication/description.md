# User Authentication Flow

## Business context

Payload CMS supports multiple authentication-enabled collections. Users authenticate via credentials (email/username + password), API keys, or custom strategies. The system issues JWT tokens and manages sessions.

## Trigger

A user submits login credentials (via API endpoint or local operation call).

## Goal

Verify user identity, issue a signed JWT token, create a session, and return the authenticated user with token.

## Participants

- **Auth Strategies** — Verify credentials (local password hash comparison, JWT token verification, API key lookup)
- **Auth Operations** — Orchestrate the login flow: validate input, authenticate, manage hooks, issue tokens
- **Token Management** — JWT signing/verification, cookie generation, session lifecycle
- **Permissions** — Evaluate per-operation access for all entities based on the authenticated user

## Paths

### Happy path

1. User submits email/username and password
2. System looks up user by email/username (excluding trashed users)
3. System checks user is not locked
4. Local strategy verifies password via PBKDF2 hash comparison
5. System checks email is verified (if verification is enabled)
6. Transaction begins for remaining operations
7. System re-checks lock status (parallel safety)
8. Session is created and stored on user document
9. `beforeLogin` hooks execute
10. JWT is signed with user fields + session ID
11. `afterLogin` hooks execute
12. `afterRead` hooks execute (field and collection level)
13. `afterOperation` hooks execute
14. Transaction commits
15. Token + user + expiration returned

### Failed password path

1. Steps 1-3 as above
2. Password hash comparison fails
3. If account lockout is enabled: login attempts are incremented (atomic)
4. Lock status is re-checked (may have been locked by parallel attempt)
5. AuthenticationError thrown

### Locked account path

1. Steps 1-2 as above
2. `lockUntil` is in the future
3. LockedAuth error thrown immediately

### Session rollback path

1. Steps 1-9 succeed
2. Error occurs during JWT signing or hook execution
3. Created session is revoked
4. Transaction is killed
5. Error propagates

## Invariants across all paths

- Passwords are never stored in plaintext; PBKDF2 with SHA-256 and 25,000 iterations is used
- Email addresses are always lowercased and trimmed before lookup
- Trashed users are excluded from login queries
- Account lockout uses atomic `$inc` for concurrent safety
- Session creation sets `updatedAt` to null to avoid spurious timestamp changes
