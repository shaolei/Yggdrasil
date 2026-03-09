# Auth Module

## Identity

The top-level auth module for Payload CMS. Contains authentication strategies, auth operations (login, logout, refresh, forgot/reset password, email verification), access control execution, JWT/cookie/session management, and type definitions.

## Boundaries

- IS responsible for: user authentication, token issuance, session management, access control evaluation, account lockout, cookie management, password hashing
- IS NOT responsible for: database adapter implementation, collection CRUD operations, admin UI rendering, field validation (uses field validators from elsewhere)
- IS NOT responsible for: the actual access function definitions — those are user-defined in collection/global configs
