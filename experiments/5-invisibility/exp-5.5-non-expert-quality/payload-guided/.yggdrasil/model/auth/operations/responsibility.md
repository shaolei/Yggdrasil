# Auth Operations

## Responsibility

Implements the core auth operations: login, logout, refresh, forgot password, reset password, verify email, unlock, register first user, me (current user), and access (permissions check).

Each operation follows the hook lifecycle pattern and handles its own transaction management (initTransaction/commitTransaction/killTransaction).

## Key Behaviors

- **Login**: validates credentials, manages brute force protection, creates sessions, signs JWT. Transaction starts AFTER password verification (to avoid holding transaction during slow pbkdf2). If session was created but a later step fails, the session is revoked in the catch block.
- **Refresh**: re-signs the JWT with extended expiry, extends session expiry, cleans up expired sessions.
- **Logout**: removes session(s) from user document. Supports single session or all sessions.

## Not Responsible For

- Actual password hashing/verification (delegated to local strategy)
- JWT signing mechanics (delegated to jwt module)
- Session storage details (delegated to sessions module)
