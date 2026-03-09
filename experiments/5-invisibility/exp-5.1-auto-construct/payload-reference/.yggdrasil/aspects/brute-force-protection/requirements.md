# Brute Force Protection

## What

When `maxLoginAttempts` is configured (> 0) on a collection:

1. Failed password attempts increment `loginAttempts` using atomic `$inc` operations
2. When attempts reach `maxLoginAttempts`, the account is locked by setting `lockUntil` timestamp
3. Locked accounts reject login with `LockedAuth` error
4. Successful login resets `loginAttempts` to 0 and clears `lockUntil`
5. Expired locks restart the counter at 1 on next failed attempt

## Parallel Request Safety

The system handles concurrent login attempts:

- `incrementLoginAttempts` operates outside the request transaction so increments are visible to parallel requests
- After successful password verification, the login operation re-reads `lockUntil` and `loginAttempts` from DB to check if parallel bad attempts locked the account
- When max attempts are reached with parallel requests, sessions created within a 20-second window are revoked (protects against 99 bad + 1 correct parallel attempts)
- `checkLoginPermission` is called multiple times during login: before authentication, after failed auth (post-increment), and after successful auth (post re-read)

## Why

Without rate limiting, automated tools can attempt millions of passwords. Account locking creates a time-based barrier. The parallel-safety measures prevent a race condition where a correct password attempt succeeds while simultaneous incorrect attempts should have locked the account.
