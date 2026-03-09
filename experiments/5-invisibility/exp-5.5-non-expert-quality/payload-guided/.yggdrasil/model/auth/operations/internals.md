# Auth Operations Internals

## Login Flow

1. Check if local strategy is disabled -> throw Forbidden
2. Run beforeOperation hooks
3. Validate input (email/username/password required based on config)
4. Build where query (supports email, username, or both; sanitizes input to lowercase+trim)
5. Exclude trashed users from query
6. Look up user by email/username
7. Check if user exists and isn't locked (`checkLoginPermission`)
8. Verify password via `authenticateLocalStrategy` (pbkdf2, 25k iterations)
9. If wrong: increment login attempts, re-check lock status, throw AuthenticationError
10. If right: check email verification status
11. **START TRANSACTION** (only after auth succeeds)
12. Re-read lockUntil/loginAttempts from DB to catch parallel locks
13. Create session (if sessions enabled)
14. Run beforeLogin hooks
15. Sign JWT
16. Run afterLogin hooks
17. Run afterRead field hooks + collection afterRead hooks
18. Run afterOperation hooks
19. Commit transaction
20. On error: revoke session if created, kill transaction

## Decisions

- **Chose to start transaction AFTER password verification** over wrapping the entire operation in a transaction because pbkdf2 is deliberately slow (25k iterations) and holding a transaction during that blocks other DB operations. Rejected alternative: full-operation transaction.

- **Chose to re-check lock status after successful auth** (step 12) over trusting the initial check because parallel failed attempts could lock the account between the initial check and the transaction start.

- **Chose to revoke session on error** (step 20) over leaving orphaned sessions because a created session with a failed transaction would leave the user in an inconsistent state.

## State

The login operation modifies these fields on the user document:
- `sessions` — new session added (if sessions enabled)
- `loginAttempts` — reset to 0 on success, incremented on failure
- `lockUntil` — set when max attempts reached, cleared on successful login after lock expires
- `collection` — set to collection slug
- `_strategy` — set to 'local-jwt'
