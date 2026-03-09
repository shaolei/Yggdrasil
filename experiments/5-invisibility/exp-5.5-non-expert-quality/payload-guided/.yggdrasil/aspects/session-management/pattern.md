# Session Management Pattern

## What

Sessions are stored as an array on the user document (not in a separate table). Each session has an `id` (UUID), `createdAt`, and `expiresAt`. Operations that modify sessions set `user.updatedAt = null` to prevent the profile's updatedAt timestamp from changing.

## Why

Storing sessions on the user document keeps the data model simple and avoids a separate sessions table. Setting `updatedAt = null` prevents login/refresh/logout from appearing as user profile edits in the admin UI and audit logs.

## Participants

- **Login**: creates a session via `addSessionToUser`
- **Refresh**: extends session expiry, removes expired sessions
- **Logout**: removes session(s) by session ID (supports single or all sessions)
- **JWT Strategy**: validates session exists during token verification

## Constraints

- Expired sessions are cleaned up opportunistically (on login and refresh), not by a background job
- Session creation uses `returning: false` on DB update (optimization: don't return the full user doc)
