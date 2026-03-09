# Brute Force Protection Pattern

## What

Failed login attempts are tracked per user. After `maxLoginAttempts` failures, the account is locked for `lockTime` milliseconds. The system handles parallel login attempts specially.

## Concurrency Model

`incrementLoginAttempts` deliberately does NOT use `req` (transaction context) for its DB calls. This means increments are visible across concurrent requests immediately, not isolated by transactions. It uses the atomic `$inc` operator to avoid read-modify-write races.

## Parallel Attack Protection

Scenario: attacker sends 99 wrong + 1 correct password in parallel.

1. The correct attempt finishes first (no extra DB update needed), creates a session
2. Failed attempts detect max attempts reached
3. The system purges sessions created in the last 20 seconds
4. This invalidates the potentially-brute-forced session

The 20-second window is a heuristic — long enough to catch parallel requests, short enough to not kill legitimate older sessions.

## Re-check Pattern

After incrementing login attempts, the login operation re-checks `checkLoginPermission` to detect if a parallel request locked the account. After successful authentication, it re-reads lockUntil/loginAttempts from the database to catch parallel lock events.

## Constraints

- Lock is time-based (`lockUntil` timestamp), not a boolean flag
- Expired locks reset the attempt count to 1 on next attempt
- `isUserLocked` simply checks if `lockUntil > Date.now()`
