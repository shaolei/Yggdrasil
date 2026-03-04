# Aspect: retry-on-deadlock
# Retry on Deadlock

Delete+reorder operations use a retry loop because concurrent modifications to sibling orderIndexes can cause transient database errors.

## Retry conditions

The retry loop continues ONLY for these specific Prisma error codes:
- `UNIQUE_CONSTRAINT_VIOLATION` — two operations assigned the same orderIndex
- `TRANSACTION_DEADLOCK` — two transactions locked rows in conflicting order
- `TRANSACTION_TIMEOUT` — lock wait exceeded timeout

Any other database error is NOT retried — it indicates a non-transient problem (bad data, missing record, etc.).

## Strategy

- Maximum retries: 5 (`MAX_RETRIES`)
- Delay: linear backoff `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)
- On exhaustion: returns `E.left(TEAM_COL_REORDERING_FAILED)`

## Why linear, not exponential

The lock contention window is short (sibling set under one parent). Linear backoff provides sufficient jitter without the long delays of exponential backoff. The maximum total wait is 1.5 seconds, acceptable for a real-time collaboration tool.

## Where this applies

Currently only `deleteCollectionAndUpdateSiblingsOrderIndex`. Other order mutations (create, move, reorder) do NOT retry — they rely solely on pessimistic locking. The delete operation needs retries because it can race with concurrent deletes on the same sibling set (the lock is per-transaction, and two deletes may each start a transaction before either acquires the lock).

