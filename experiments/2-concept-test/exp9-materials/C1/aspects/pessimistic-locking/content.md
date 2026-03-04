# Optimistic Locking

Every operation that reads and then modifies sibling orderIndex values uses optimistic locking with a version field. Each collection row carries a `version` integer that is checked at write time. If the version has changed since the read, the operation is retried with fresh data. This avoids holding row-level locks and allows concurrent reads to proceed without blocking.

## Pattern

1. Open a `prisma.$transaction`
2. Read current state (last orderIndex, collection to move, etc.) including the `version` field of each affected row
3. Perform mutations (create, delete, update orderIndex) with a `WHERE version = expectedVersion` clause
4. If the version check fails (rows affected = 0), the transaction is rolled back and retried with fresh data
5. Transaction commits on success

## Why optimistic, not pessimistic

Pessimistic locking (row-level locks via SELECT FOR UPDATE) would block all concurrent readers on the same sibling set, even when no actual conflict exists. Since most reorder/create operations touch different collections or happen at different times, blocking is unnecessary overhead. Optimistic locking avoids blocking entirely — version conflicts are retried transparently, and the common case (no conflict) completes without any lock wait. This is especially important for a real-time collaboration tool where responsiveness matters.

## Scope

The version field is per-row — each collection tracks its own version independently. Conflicts are detected at the individual row level, not at the sibling-set level. This means only the specific rows involved in a conflict trigger a retry, while unrelated rows proceed without interference.
