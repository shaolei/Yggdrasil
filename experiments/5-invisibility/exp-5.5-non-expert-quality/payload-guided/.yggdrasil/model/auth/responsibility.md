# Auth Module

## Responsibility

The auth module handles all authentication and authorization concerns for Payload CMS. This includes user login/logout, token management (JWT signing/verification), session lifecycle, password verification, brute force protection, and the auth strategy pipeline.

## Not Responsible For

- Defining access functions (those are user-configured per collection/global/field)
- Database adapter implementation (uses `payload.db` abstraction)
- HTTP routing (endpoints are defined elsewhere, operations are called from endpoint handlers)
- User collection schema definition (auth fields are added during config sanitization)
