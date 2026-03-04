# Retry on Deadlock

Order-mutating operations use a retry loop because concurrent modifications to sibling orderIndexes can cause transient database errors.

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

Retries apply to create, move, and reorder operations — all mutations that modify sibling orderIndex ranges. The delete operation does NOT use retries because delete is idempotent: once a row is removed, re-running the delete has no additional effect, and the subsequent sibling reindexing operates on a smaller set that is unlikely to conflict. Create, move, and reorder are non-idempotent and can produce duplicate orderIndex assignments if two operations interleave, so they need the retry safety net.
