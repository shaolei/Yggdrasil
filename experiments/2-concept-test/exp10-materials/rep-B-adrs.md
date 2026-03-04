# TeamCollectionService -- Architecture Decision Records

## Module Overview

**Service:** `TeamCollectionService`
**File:** `packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`
**Framework:** NestJS (TypeScript, Node.js)
**ORM:** Prisma
**Error handling:** fp-ts Either/Option (never throw for business errors)

### Responsibility

The central service for all team collection operations in Hoppscotch. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

### In Scope

- Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves
- Import/export: recursive JSON serialization and deserialization of entire collection subtrees
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access

### Out of Scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections (separate TeamRequest service)
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)

### Constraints Summary

- **Circular reference prevention:** A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`.
- **OrderIndex contiguity:** Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1.
- **Same-team constraint:** A collection can only be moved to a parent within the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`.
- **Self-move prevention:** A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered next to itself (`TEAM_COL_SAME_NEXT_COLL`).
- **Already-root guard:** Moving a root collection to root (parentID null to null) is rejected with `TEAM_COL_ALREADY_ROOT` as a no-op prevention.
- **Title minimum length:** Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles rejected with `TEAM_COLL_SHORT_TITLE`.
- **Data field validation:** The optional `data` field must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON rejected with `TEAM_COLL_DATA_INVALID`.

---

## ADR-001: Use Pessimistic Locking for Collection Mutations

**Status:** Accepted
**Date:** 2024-01-15

**Context:** Team collections are organized as a tree with integer-based sibling ordering (orderIndex). Multiple users on the same team can concurrently create, delete, reorder, and move collections. Any operation that reads a sibling's orderIndex and then writes a new value based on that read is susceptible to race conditions: two concurrent operations could read the same "last orderIndex" and both assign the same value, creating duplicates. Alternatively, two reorder operations could interleave their reads and writes, producing gaps or ordering inconsistencies.

**Decision:** Every operation that reads and then modifies sibling orderIndex values must first acquire a pessimistic row lock by calling `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` within a `prisma.$transaction`. This locks all sibling rows under the given parent for the duration of the transaction, serializing concurrent access. The pattern is:

1. Open a `prisma.$transaction`
2. Call `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` -- locks all sibling rows under the given parent
3. Read current state (last orderIndex, collection to move, etc.)
4. Perform mutations (create, delete, update orderIndex)
5. Transaction commits, releasing locks

The lock is scoped to `(teamID, parentID)` -- it locks siblings, not the entire team's collections. Operations on different subtrees can proceed in parallel.

**Consequences:**

- Positive: Race conditions on sibling orderIndex are eliminated within a parent group. The code can safely read-then-write without version checks. No version column needed on every row.
- Positive: Lock scope is narrow (per-parent sibling set), so different subtrees don't block each other.
- Negative: Concurrent operations on the same parent are serialized, reducing throughput for heavily contested parent nodes.
- Negative: Potential for deadlocks when two transactions lock overlapping parent groups in different order (mitigated by retry logic in ADR-005).

**Alternatives considered:**

- *Optimistic locking (version columns + retry on conflict):* Rejected because reorder operations often touch MANY siblings via `updateMany` with range conditions. A single conflicting row would invalidate the entire batch, requiring full retries of multi-row updates. The granularity mismatch (single-row version check vs. batch update) makes optimistic locking impractical for this use case.
- *Application-level mutex / distributed lock:* Rejected because it would not integrate with the database transaction lifecycle and would add infrastructure complexity (Redis, etc.) for a problem that database-level locking handles natively.

---

## ADR-002: Use Integer orderIndex Instead of Fractional

**Status:** Accepted
**Date:** 2024-01-15

**Context:** Collections within a parent need a defined display order. The UI supports drag-and-drop reordering, and the backend must persist and serve this order consistently. Two common approaches exist: integer-based ordering (contiguous integers starting at 1) and fractional ordering (assigning floating-point or string values between existing items).

**Decision:** Use integer-based `orderIndex` with gap-filling. The invariant is: within a sibling set (same `teamID` + `parentID`), orderIndex values are contiguous starting from 1. Every mutation maintains this invariant:

- **Create:** Append at `lastIndex + 1`
- **Delete:** Decrement all siblings with orderIndex greater than the deleted item
- **Reorder:** Shift affected range up or down by 1, then place the moved item at the target position
- **Move between parents:** Decrement siblings in the source parent, append at end of destination parent

**Consequences:**

- Positive: Indexes are always contiguous and predictable, enabling reliable cursor-based pagination and consistent UI rendering.
- Positive: Simple to reason about -- no precision exhaustion, no rebalancing passes.
- Positive: No-gaps invariant means the UI can trust that `orderIndex` values form a clean 1..N sequence.
- Negative: Every delete, reorder, and move operation must touch multiple sibling rows (range updates), increasing write amplification.
- Negative: Requires pessimistic locking (ADR-001) to prevent concurrent mutations from creating gaps or duplicates.

**Alternatives considered:**

- *Fractional ordering (e.g., assign 1.5 between items at 1 and 2):* Avoids touching siblings on each mutation, but eventually requires a rebalancing pass when precision is exhausted (e.g., inserting between 1.0000001 and 1.0000002). For a real-time collaborative tool where consistency matters more than write throughput, the complexity of rebalancing and the unpredictability of fractional values were deemed worse trade-offs than the write amplification of integer ordering.
- *Linked list ordering (each item points to "next"):* Requires traversal to determine position, incompatible with efficient range queries and pagination.

---

## ADR-003: Implement Duplication via Export+Import Pipeline

**Status:** Accepted
**Date:** 2024-01-20

**Context:** Users need the ability to duplicate an entire collection tree (including all nested child collections and requests). This requires a deep copy of an arbitrarily nested structure, with each duplicate getting new IDs and correct orderIndex values.

**Decision:** Duplication is implemented by reusing the existing export and import pipeline:

1. `exportCollectionToJSONObject(teamID, collectionID)` -- recursively serializes the entire collection subtree to a `CollectionFolder` JSON structure
2. Modify the title by appending `" - Duplicate"`
3. `importCollectionsFromJSON(jsonString, teamID, parentID)` -- deserializes and creates the entire subtree with new IDs, correct orderIndexes, and proper locking

The `duplicateTeamCollection` method is therefore just orchestration:
```typescript
export -> modify title -> import
```

**Consequences:**

- Positive: Zero code duplication. The recursive creation logic (handling nested children, requests, locking, orderIndex assignment) exists only in the import path.
- Positive: Any bug fix or enhancement to import automatically applies to duplication.
- Positive: Simple to understand and maintain.
- Negative: Slightly more overhead than a direct deep-copy (serialization round-trip to JSON and back).
- Negative: The duplicate inherits any quirks of the export/import pipeline (e.g., if export drops a field, duplication drops it too).

**Alternatives considered:**

- *Dedicated deep-copy method:* Rejected because it would duplicate the recursive tree-walking, ID generation, orderIndex assignment, and locking logic that already exists in the import path. Maintaining two parallel implementations of the same algorithm is a bug factory.
- *Database-level copy (INSERT...SELECT):* Rejected because it would bypass the application-level locking, PubSub event emission, and orderIndex assignment logic.

---

## ADR-004: Walk Up Tree for Cycle Detection (Not Down)

**Status:** Accepted
**Date:** 2024-01-15

**Context:** When moving a collection to a new parent, the system must prevent circular references (e.g., moving a parent into its own descendant). Two approaches: walk down from the source through all descendants looking for the destination, or walk up from the destination to the root looking for the source.

**Decision:** The `isParent` method walks UP from the destination collection to the root, following `parentID` links. At each step, it checks if the current node is the source collection. If it reaches the root (parentID === null) without finding the source, the move is safe. If it encounters the source, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`.

Algorithm:
1. If source === destination: return `O.none` (invalid, self-move)
2. If `destination.parentID === source.id`: return `O.none` (source IS an ancestor, would create cycle)
3. If `destination.parentID !== null`: recurse with `destination = destination.parent`
4. If `destination.parentID === null`: reached root without finding source, return `O.some(true)` (safe to move)

`O.none` = invalid (would create cycle), `O.some(true)` = valid.

**Consequences:**

- Positive: Performance is O(depth), following a single chain of parentID pointers from destination to root. Tree depth is typically small (5-10 levels).
- Positive: No need to load the entire subtree of the source collection, which could be arbitrarily large.
- Negative: Requires N database queries (one per ancestor level) in the worst case. Could be optimized with a recursive CTE, but the current recursive approach is simpler and tree depth is bounded in practice.

**Alternatives considered:**

- *Walk DOWN from source through all descendants:* Rejected because it requires loading the entire subtree rooted at the source, which is O(subtree_size) -- potentially hundreds or thousands of collections. Walking up is O(depth), which is always less than or equal to the total tree height.
- *Recursive CTE to check ancestry in one query:* Would reduce round-trips but adds SQL complexity. The current approach is simple and tree depth is typically shallow enough that the round-trips are acceptable.

---

## ADR-005: Retry Only Delete Operations on Deadlock

**Status:** Accepted
**Date:** 2024-01-20

**Context:** Despite pessimistic locking (ADR-001), the delete+reindex operation can still encounter deadlocks. Two concurrent deletes on the same sibling set each start a transaction, acquire locks, then try to decrement overlapping ranges. If lock acquisition order differs between the two transactions, a deadlock occurs.

**Decision:** Only the `deleteCollectionAndUpdateSiblingsOrderIndex` method uses a retry loop. The retry logic:

- Maximum retries: 5 (`MAX_RETRIES`)
- Delay: linear backoff at `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)
- Retried error codes (Prisma error codes):
  - `UNIQUE_CONSTRAINT_VIOLATION` -- two operations assigned the same orderIndex
  - `TRANSACTION_DEADLOCK` -- two transactions locked rows in conflicting order
  - `TRANSACTION_TIMEOUT` -- lock wait exceeded timeout
- Any other database error is NOT retried (indicates a non-transient problem)
- On exhaustion: returns `E.left(TEAM_COL_REORDERING_FAILED)`

**Consequences:**

- Positive: Transient deadlocks during concurrent deletes are handled transparently.
- Positive: Non-transient errors fail fast without wasting retry attempts.
- Positive: Maximum total wait is 1.5 seconds, acceptable for a real-time tool.
- Negative: Only covers delete; if other operations encounter deadlocks, they will fail without retry.

**Alternatives considered:**

- *Retry all mutation operations:* Rejected because create and move operations are less prone to deadlocks. Creates append at the end (non-overlapping ranges), and moves shift in one direction. Adding retry logic everywhere would add complexity without measurable benefit.
- *Exponential backoff:* Rejected because the lock contention window is short (sibling set under one parent). Linear backoff provides sufficient jitter without the long delays of exponential backoff.
- *Queue-based serialization of deletes:* Rejected as over-engineering for a relatively rare race condition. The retry loop is simple and effective.

---

## ADR-006: Emit PubSub Events After Transaction Commit Only

**Status:** Accepted
**Date:** 2024-01-15

**Context:** Hoppscotch is a real-time collaborative tool. Every mutation to a team collection must publish a PubSub event so that connected clients (GraphQL subscriptions) receive live updates. The question is when to emit these events relative to the database transaction.

**Decision:** PubSub events are published AFTER the database transaction commits successfully. The publish call is placed outside the `prisma.$transaction` block, after it resolves. This applies to all mutation methods:

- `createCollection` -- publishes `coll_added` after transaction
- `deleteCollection` -- publishes `coll_removed` after the retry loop succeeds
- `moveCollection` -- publishes `coll_moved` after transaction
- `updateCollectionOrder` -- publishes `coll_order_updated` after transaction
- `renameCollection` / `updateTeamCollection` -- publishes `coll_updated` after update
- `importCollectionsFromJSON` -- publishes `coll_added` for each created collection after transaction

Channel naming convention: `team_coll/${teamID}/coll_added|coll_updated|coll_removed|coll_moved|coll_order_updated`

Payload shapes:
- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string
- Order updated: `{ collection, nextCollection }` pair

**Consequences:**

- Positive: No phantom events. Clients never see an event for a change that was rolled back.
- Positive: Event payload reflects the committed state of the data.
- Negative: If the PubSub publish fails after a successful commit, clients miss the update. There is no retry or outbox pattern for event delivery.
- Negative: Slight delay between commit and event delivery (negligible in practice).

**Alternatives considered:**

- *Emit events inside the transaction:* Rejected because if the transaction rolls back, the event is already published, creating phantom updates that confuse connected clients.
- *Transactional outbox pattern:* Would guarantee event delivery by writing events to a database table within the same transaction, then processing them asynchronously. Rejected as over-engineering for the current scale and use case.

---

## ADR-007: Use Range-Shift for Reorder (Not Swap)

**Status:** Accepted
**Date:** 2024-01-15

**Context:** When a user drags a collection to a new position within the same parent, the backend must update orderIndex values. The API uses "next collection" semantics: the client specifies "place me just before this collection" (or null for "move to end").

**Decision:** The `updateCollectionOrder` method uses a range-shift algorithm:

### Move to end (nextCollectionID = null):
1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

### Move to specific position (nextCollectionID != null):
1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up then `nextCollection.orderIndex`, if moving down then `nextCollection.orderIndex - 1`

The "next collection" semantics mean: "place me just before this collection."

Both paths re-read orderIndex values inside the transaction after acquiring the lock. This guards against race conditions where the orderIndex changed between the initial read (outside the transaction) and the lock acquisition.

**Consequences:**

- Positive: Maintains the contiguity invariant (ADR-002) -- no gaps, no duplicates after any reorder.
- Positive: Handles both "move up" and "move down" directions correctly with a single unified algorithm.
- Positive: Range updates via `updateMany` are efficient in the database.
- Negative: Touches O(distance) sibling rows for each reorder, where distance is the number of positions moved.

**Alternatives considered:**

- *Swap (exchange orderIndex of two items):* Only works for adjacent swaps. For moving an item multiple positions, it would require multiple swaps, each needing its own transaction or lock. The range-shift approach handles any distance in a single transaction.
- *Remove and re-insert (delete orderIndex, reindex all, insert at new position):* More writes than necessary. The range-shift only touches the affected range, not all siblings.

---

## Supplementary Decisions (Not Full ADRs)

### Why search uses raw SQL instead of Prisma query builder

The search feature requires PostgreSQL-specific capabilities: `ILIKE` for case-insensitive matching, the `similarity()` function for fuzzy ranking, and `escapeSqlLikeString` for safe wildcard injection. Prisma's query builder does not expose `similarity()` or custom ordering by a function result. Raw SQL via `prisma.$queryRaw` is the only option for this query pattern.

### Why parent tree reconstruction uses recursive CTE

After finding search matches, the UI needs to display breadcrumb paths (e.g., "Team > Parent Collection > Child Collection > Match"). Rather than making N queries to walk up the tree per result, a single `WITH RECURSIVE` CTE efficiently fetches the entire ancestor chain in one query. This is critical for performance when search returns many results.

### Move collection is a two-parent operation

The `changeParentAndUpdateOrderIndex` method modifies sibling indexes in BOTH the source and destination parents within a single transaction:
1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

Both parent groups must be locked. The source parent's siblings get their gap filled, and the destination parent gets the new collection appended at the end.
