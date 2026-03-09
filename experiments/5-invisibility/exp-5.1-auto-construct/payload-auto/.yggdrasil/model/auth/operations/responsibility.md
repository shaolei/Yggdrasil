# Auth Operations

## Identity

Orchestrates all authentication operations: login, logout, refresh, me, access check, forgot/reset password, email verification, first user registration, and account unlock. Also contains access control execution (`executeAccess`, `defaultAccess`, `getAccessResults`).

## Boundaries

- IS responsible for: operation orchestration, hook execution sequencing, transaction management, input validation (email/username/password), access control evaluation dispatch
- IS NOT responsible for: password hashing (delegates to strategies), JWT signing (delegates to token-management), session storage (delegates to token-management)
- IS NOT responsible for: field-level permission resolution (delegates to permissions module)
