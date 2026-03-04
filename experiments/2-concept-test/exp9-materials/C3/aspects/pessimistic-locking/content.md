# Pessimistic Locking

Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first. Without this, two concurrent reorder/create/delete operations on siblings under the same parent could read stale orderIndex values and produce duplicates or gaps.

## Pattern

1. Open a `prisma.$transaction`
2. Call `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` — this locks all sibling rows under the given parent
3. Read current state (last orderIndex, collection to move, etc.)
4. Perform mutations (create, delete, update orderIndex)
5. Transaction commits, releasing locks

## Why pessimistic, not optimistic

Optimistic locking (version columns + retry on conflict) would require every collection row to carry a version field and every read to include it. Since reorder operations often touch MANY siblings (updateMany with range conditions), optimistic locking would be impractical — a single conflicting row would invalidate the entire batch. Pessimistic locking serializes access to the sibling set, which is the correct granularity.

## Scope

The lock is scoped to `(teamID, parentID)` — it locks siblings, not the entire team's collections. This means operations on different subtrees can proceed in parallel.
