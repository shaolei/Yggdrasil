# Auth System

## Identity

The authentication and access control system for Payload CMS. Provides identity verification (login, JWT, API keys), session management, password lifecycle (forgot/reset), and permission evaluation for all collections and globals.

## Responsibilities

- Authenticate users via local strategy (email/username + password), JWT tokens, or API keys
- Manage JWT token lifecycle (sign, verify, refresh, extract from headers/cookies)
- Manage server-side sessions (create, revoke, expire)
- Evaluate access control functions at entity and field level
- Track login attempts and lock accounts for brute-force protection
- Handle password reset flow (token generation, email, reset)
- Provide permission introspection for admin UI

## Not Responsible For

- User CRUD operations (handled by collection operations)
- User schema/field definitions (defined in collection config)
- Email transport (delegates to payload.email service)
- Database operations (delegates to payload.db adapter)
- Route mounting or HTTP server setup
- OAuth/external SSO providers (extensible via custom strategies, but not built-in to core)
