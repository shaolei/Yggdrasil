# Password Reset

## Business context

A user who has forgotten their password can request a reset token via email, then use that token to set a new password and receive a fresh JWT session.

## Trigger

Two-phase: (1) POST to `/<collection>/forgot-password` with email/username, (2) POST to `/<collection>/reset-password` with token + new password.

## Goal

Allow users to regain access to their account by proving ownership of their email address.

## Participants

- **Auth Endpoints** — receives HTTP requests for both phases
- **Auth Operations** — orchestrates forgot-password (token generation + email) and reset-password (token validation + password update + new session)
- **Auth Infrastructure** — provides password hashing (generatePasswordSaltHash), JWT signing, session management

## Paths

### Happy path

1. User requests password reset with email/username
2. System looks up user (silently returns null if not found — prevents email enumeration)
3. System generates random 20-byte hex token
4. System stores token and expiration (default 1 hour) on user document
5. System sends reset email with link (customizable via `generateEmailHTML`/`generateEmailSubject` hooks)
6. User clicks link and submits new password with token
7. System validates token exists and has not expired
8. System generates new salt + hash using pbkdf2 (25000 iterations, 512-byte key, sha256)
9. System validates password against collection's password validation rules
10. System updates user document with new hash/salt
11. System creates new session and signs new JWT
12. System runs beforeLogin/afterLogin hooks (reset-password acts as implicit login)

### User not found path

- `forgotPassword` silently returns null without indicating whether the email exists
- This prevents email enumeration attacks

### Token expired/invalid path

- `resetPassword` throws 403 "Token is either invalid or has expired"

## Invariants across all paths

- `disableLocalStrategy` check is performed before any operation
- Forgot-password never reveals whether an email/username exists in the system
- Reset-password always re-authenticates the new password after saving (verification step)
- Reset-password creates a new session, effectively logging the user in
