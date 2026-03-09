# Auth Operations — Internals

## Logic

### Login Flow Control

The login operation has a critical ordering:

1. **Pre-transaction phase** (no transaction): user lookup, lock check, password verification, login attempt tracking. These happen outside a transaction so parallel requests can see each other's updates.
2. **Transaction phase**: session creation, hooks, JWT signing, afterRead. These are transactional — if anything fails, the session is revoked and the transaction killed.

The separation is intentional: lock/attempt tracking must be visible across concurrent requests, while session creation must be atomic.

### Username/Email Login Flexibility

The `loginWithUsername` config option controls three modes:
- Email only (default): standard email+password
- Username only: `loginWithUsername: { allowEmailLogin: false }`
- Both: `loginWithUsername: { allowEmailLogin: true }` — uses OR query to match either field, and also tries cross-matching (username field matched against email input and vice versa)

### Access Control Evaluation

`getAccessResults` runs all collection and global access functions in parallel (`Promise.all`). For collections with auth enabled and `maxLoginAttempts > 0`, the `unlock` operation is included. For versioned entities, `readVersions` is included.

## Constraints

- Emails are always lowercased and trimmed before comparison
- Trashed users are excluded from login queries via `appendNonTrashedFilter`
- The `checkLoginPermission` function is called up to 3 times during a login: before auth, after failed auth (post-increment), and after successful auth (re-read). Each serves a different purpose.

## Decisions

- **Session rollback on error**: If session was created but a subsequent step fails, the session is explicitly revoked. Chose explicit revocation over relying on transaction rollback — rationale: unknown, possibly because session updates bypass the request transaction.
- **Triple lock check in login**: rationale from code comment — "re-check that the account didn't get locked by parallel bad attempts in the meantime." The third check catches a race where another request locked the account between password verification and JWT signing.

## State

- `user._strategy` is set to `'local-jwt'` on the user object during login to identify the authentication method
- `user.collection` is set to the collection slug
