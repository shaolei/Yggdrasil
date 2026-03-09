# Auth Operations

## Identity

The business logic layer for all authentication operations. Each operation orchestrates validation, data access, hook execution, and infrastructure calls in a transaction-safe manner.

## Responsibilities

- Login: validate credentials, verify password, manage brute-force tracking, create session, sign JWT
- Logout: revoke session (single or all), run hooks
- Refresh: validate existing session, extend expiration, issue new JWT
- Forgot password: generate reset token, send email, silently handle unknown users
- Reset password: validate token, hash new password, create new session, sign JWT
- Register first user: bootstrap initial admin user when no users exist
- Verify email: validate verification token
- Unlock: manually unlock a locked account
- Me: return current authenticated user
- Access: delegate to getAccessResults for permission introspection

## Not Responsible For

- HTTP request/response handling (handled by endpoints)
- Cookie generation (handled by endpoints via infrastructure)
- Password hashing algorithms (delegated to infrastructure)
- JWT signing/verification (delegated to infrastructure)
- Session storage (delegated to infrastructure + DB adapter)
- Defining auth configuration (defined in collection config)
