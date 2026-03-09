# Account Lockout Pattern

## What

When `maxLoginAttempts > 0`, the system tracks failed login attempts and locks accounts after the threshold is reached. Locked accounts cannot authenticate until the lock expires.

## Rules

1. Failed password attempts increment `loginAttempts` via atomic `$inc` operation.
2. When `loginAttempts >= maxLoginAttempts`, `lockUntil` is set to `now + lockTime`.
3. Expired locks reset the counter to 1 on next attempt (not 0 — the current attempt counts).
4. Successful login resets both `loginAttempts` to 0 and `lockUntil` to null.
5. Lock checking (`isUserLocked`) compares `lockUntil` timestamp against `Date.now()`.
6. Login operations deliberately skip the `req` parameter in DB updates to ensure parallel requests on different transactions can see each other's changes.
7. When max attempts are reached with sessions enabled, all sessions created in the last 20 seconds are revoked. This protects against brute-force attacks where one correct attempt among many parallel attempts succeeds.

## Why (partial — from code comments)

The parallel-safety logic exists because of race conditions: multiple login attempts can be in-flight simultaneously. The code re-reads the user after incrementing attempts and re-checks lock status. The 20-second session revocation window was chosen because "the correct login attempt will be finished first, as it's faster due to not having to perform an additional db update" (from code comment in incrementLoginAttempts.ts).

rationale for 20-second window: unknown — likely empirical. No git history available explaining the choice of 20 seconds specifically.
