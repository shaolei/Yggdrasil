# Auth Operations — Internals

## Logic

### Login operation flow

1. Check `disableLocalStrategy` — reject early if local auth is disabled
2. Run `buildBeforeOperation` (may mutate args)
3. Sanitize email (lowercase, trim) and username
4. Determine login options from `loginWithUsername` config (3 modes: email-only, username-only, both)
5. Build Where query:
   - Both enabled + username provided: `OR(username=input, email=input)` (allows username field to match email)
   - Both enabled + email provided: `OR(email=input, username=input)` (allows email field to match username)
   - Single mode: simple equality on the configured field
6. Append non-trashed filter
7. Find user via `payload.db.findOne`
8. `checkLoginPermission` — throws if null or locked
9. Set `user.collection` and `user._strategy = 'local-jwt'`
10. `authenticateLocalStrategy` — returns user doc or null
11. On auth failure: increment attempts (if enabled) → re-check permission → throw AuthenticationError
12. On auth success: check `_verified` if verification enabled
13. Start transaction (all remaining ops are transactional)
14. Re-read lock status from DB (parallel safety check)
15. `addSessionToUser` (if sessions enabled)
16. `getFieldsToSign` → `jwtSign`
17. `resetLoginAttempts`
18. Run hooks: beforeLogin → sign JWT → afterLogin → afterRead → afterRead collection hooks → afterOperation
19. Commit transaction
20. On error: revoke session if created, kill transaction

### incrementLoginAttempts parallel safety

This is the most complex piece. Key details:
- Uses `$inc: 1` atomic operation (not read-modify-write) to prevent lost updates
- Operates WITHOUT the request transaction so increments are visible to parallel requests
- After incrementing, checks if max was reached for BOTH "current user" (loginAttempts - 1 >= max) and "next user" (loginAttempts >= max)
- If next user will be locked but lockUntil wasn't set (race condition), performs a second update to set lockUntil
- When locking, if sessions are enabled, removes all sessions created within the last 20 seconds (protects against a correct parallel login that completed just before the lock)

### Login with username cross-matching

When both email and username login are enabled, the system performs cross-field matching. If a username is provided, it also checks if it matches the email field (and vice versa). This allows users who registered with an email to log in using it in the username field.

### forgotPassword silent failure

When the user is not found, `forgotPasswordOperation` commits the transaction and returns `null` without throwing. The comment explains: "We don't want to indicate specifically that an email was not found, as doing so could lead to the exposure of registered emails."

### resetPassword implicit login

After updating the password, `resetPasswordOperation` calls `authenticateLocalStrategy` to verify the new password works, then creates a session and signs a JWT — effectively logging the user in. It also runs `beforeLogin` and `afterLogin` hooks.

## Decisions

- Chose atomic `$inc` for login attempt tracking over read-modify-write — rationale: unknown — inferred from code, addresses parallel request consistency
- Chose 20-second window for session revocation on lock over revoking all sessions — rationale: observable in code comment: protects against "99 incorrect, 1 correct parallel login attempts" where the correct one finishes faster
- Chose to re-check lock status after successful authentication over trusting the pre-auth check — rationale: observable in code comment: "account didn't get locked by parallel bad attempts in the meantime"
- Chose silent null return for unknown users in forgotPassword over throwing an error — rationale: explicitly documented in code to prevent email enumeration
- Chose to set `user.updatedAt = null` when adding/removing sessions over allowing timestamp update — rationale: observable in code comment: "Prevent updatedAt from being updated when only adding a session"
