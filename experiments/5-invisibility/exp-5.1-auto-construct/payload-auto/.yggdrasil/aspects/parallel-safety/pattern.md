# Parallel Safety Pattern

## What

Login attempt tracking (increment/reset) deliberately omits the `req` parameter from DB calls. This ensures updates are visible across parallel requests that may be on different transactions.

After a correct password is accepted, the login operation re-reads the user from DB to check if the account was locked by a parallel bad attempt in the meantime.

## Why

From code comment in incrementLoginAttempts.ts: "this function does not use req in its updates, as we want those to be visible in parallel requests that are on a different transaction. At the same time, we want updates from parallel requests to be visible here."

From code comment in login.ts: "Correct password accepted - re-check that the account didn't get locked by parallel bad attempts in the meantime."

## Rules

1. `incrementLoginAttempts` and its lock updates never pass `req` to `payload.db.updateOne`.
2. `resetLoginAttempts` DOES pass `req` — rationale: unknown. Possibly because reset happens within the login transaction after success is confirmed.
3. After password verification succeeds, the login operation re-fetches lockUntil and loginAttempts before proceeding.
