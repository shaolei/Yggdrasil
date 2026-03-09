# Transaction Safety

## What

All auth operations that modify data follow a transaction pattern:

1. `initTransaction(req)` — returns whether this call should commit (prevents nested commits)
2. Core logic wrapped in try/catch
3. On success: `commitTransaction(req)` if `shouldCommit` is true
4. On failure: `killTransaction(req)` then re-throw

Session operations (addSessionToUser) that fail during login are explicitly rolled back by calling `revokeSession`.

## Why

Auth operations often involve multiple database writes (e.g., update user + create session + reset login attempts). Without transactions, a failure partway through would leave the database in an inconsistent state. The `shouldCommit` flag handles nested operation calls where the outer caller manages the transaction.

## Constraints

- `incrementLoginAttempts` deliberately bypasses the request transaction (does not use `req`) so that login attempt increments are visible across parallel requests. This is intentional for brute-force protection.
- Session revocation on error is an explicit rollback outside the DB transaction, because sessions are stored as user document fields.
