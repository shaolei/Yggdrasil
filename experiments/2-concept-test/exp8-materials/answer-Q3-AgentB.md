# Q3: Switching from Pessimistic Locking to Optimistic Locking — Impact Analysis

**Source context:** `team-collections/team-collection-service` (TeamCollectionService)

---

## 1. Nodes That Use Pessimistic Locking (Visible from This Context)

From this single context package, **one node is directly visible** as using pessimistic locking:

- **TeamCollectionService** (`team-collections/team-collection-service`) — This node has `pessimistic-locking` as a declared aspect. Its responsibility explicitly states it "coordinates Prisma database transactions with pessimistic row locking."

The `pessimistic-locking` aspect is defined at the graph level, which means it could apply to other nodes as well, but those nodes are **not visible** from this context package alone. The parent hierarchy annotation (`aspects="pessimistic-locking,pubsub-events"`) indicates the entire `team-collections` domain uses pessimistic locking, so any sibling or child nodes under `team-collections/` would also be affected — but none are enumerated here.

**What I cannot see from this context:** Whether other services (e.g., TeamRequestService, TeamEnvironmentsService — both mentioned in the team-ownership aspect) also use the same `pessimistic-locking` aspect or the same `lockTeamCollectionByTeamAndParent` mechanism. The aspect content describes the pattern generically enough that it may apply elsewhere, but I have no direct evidence from this single context package.

---

## 2. Operations That Use Locking

Every operation that reads and then modifies sibling `orderIndex` values acquires a row lock. Specifically:

### Mutations that lock (within TeamCollectionService):

| Operation | What It Locks | Why |
|---|---|---|
| **createCollection** | Siblings under `(teamID, parentID)` | Must read last orderIndex, then append at `lastIndex + 1`. Concurrent creates could assign the same index. |
| **deleteCollection** (`deleteCollectionAndUpdateSiblingsOrderIndex`) | Siblings under `(teamID, parentID)` | Must decrement all siblings with orderIndex > deleted collection. Also has **retry-on-deadlock** (up to 5 retries with linear backoff). |
| **moveCollection** (`changeParentAndUpdateOrderIndex`) | Siblings under **both** source and destination `(teamID, parentID)` | Two-parent operation: decrements siblings in the source parent, appends at end of destination parent. |
| **updateCollectionOrder** (reorder) | Siblings under `(teamID, parentID)` | Shifts ranges of siblings up or down by 1 depending on direction. |
| **sortCollection** | Siblings under `(teamID, parentID)` | Reorders all children alphabetically or by other criteria. |
| **importCollectionsFromJSON** | Siblings under `(teamID, parentID)` at each level of the recursive import | Creates multiple collections in a hierarchy; each level needs orderIndex assignment. |
| **duplicateCollection** | Same as import (uses export + re-import pattern) | Delegates to importCollectionsFromJSON internally. |

### Locking pattern (from the pessimistic-locking aspect):

1. Open `prisma.$transaction`
2. Call `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` — acquires row-level locks on all sibling rows under the given parent
3. Read current state inside the transaction
4. Perform mutations
5. Commit (releases locks)

---

## 3. What Would Need to Change

### A. Schema / Data Model Changes

- **Add a `version` column** (integer or timestamp) to the `TeamCollection` table. Every row would need this field to support optimistic concurrency control.
- **Database migration** to add the version column with a default value to all existing rows.

### B. Lock Mechanism Removal

- **Remove `lockTeamCollectionByTeamAndParent`** — the raw SQL locking query (likely `SELECT ... FOR UPDATE`) would no longer be needed.
- **Remove or repurpose the `pessimistic-locking` aspect** — the aspect documentation would need to be rewritten as an `optimistic-locking` aspect, or the old aspect removed and a new one created.

### C. TeamCollectionService — All Mutation Methods

Every mutation listed in section 2 would need to change from:

**Current pattern (pessimistic):**
```
1. BEGIN TRANSACTION
2. LOCK rows (SELECT ... FOR UPDATE)
3. READ current state
4. MUTATE
5. COMMIT
```

**New pattern (optimistic):**
```
1. READ current state (including version numbers)
2. BEGIN TRANSACTION
3. MUTATE with WHERE version = <read_version>
4. Check affected row count — if 0, a concurrent modification occurred
5. COMMIT or RETRY
```

Specific per-operation changes:

- **createCollection**: Read last orderIndex + version. On insert, the WHERE clause on the parent's version (or the sibling set's state) must confirm no concurrent insertion happened. If it has, retry.

- **deleteCollection**: Currently already has retry logic (retry-on-deadlock aspect, up to 5 retries). The retry conditions would change from catching `TRANSACTION_DEADLOCK` and `TRANSACTION_TIMEOUT` Prisma error codes to catching **version mismatch** (0 rows updated). The `UNIQUE_CONSTRAINT_VIOLATION` retry condition might still apply. The retry strategy (linear backoff, max 5) could remain, but the trigger condition changes fundamentally.

- **moveCollection**: This is the hardest case. It is a **two-parent operation** — it touches sibling indexes in both the source and destination parent sets. With pessimistic locking, both sets are locked in one transaction. With optimistic locking, you would need to check versions on siblings in **both** parent sets, and a conflict in either set would require a full retry. This significantly increases the probability of conflicts.

- **updateCollectionOrder (reorder)**: Range updates (`updateMany` with conditions like `orderIndex >= X AND orderIndex <= Y`) would each need version checks. Since a single reorder can touch **many siblings**, the chance of a version conflict on any one of them is high. The aspect documentation explicitly warns about this: "Since reorder operations often touch MANY siblings (updateMany with range conditions), optimistic locking would be impractical — a single conflicting row would invalidate the entire batch."

- **sortCollection**: Rewrites orderIndex for potentially **all** children. Optimistic locking here would almost certainly conflict with any concurrent operation on the same sibling set.

- **importCollectionsFromJSON**: Recursive import creates many collections across multiple levels. Each level would need optimistic version checks. The recursive nature means a failure at any depth would need to propagate up.

- **duplicateCollection**: Delegates to import, so inherits all the import complexity.

### D. Retry-on-Deadlock Aspect Changes

The `retry-on-deadlock` aspect would need to be reworked:

- **Trigger conditions change**: Instead of catching `TRANSACTION_DEADLOCK` and `TRANSACTION_TIMEOUT`, the retry would trigger on **version mismatch** (optimistic conflict).
- **`UNIQUE_CONSTRAINT_VIOLATION`** might still need handling if two concurrent creates assign the same orderIndex.
- **Scope expands**: Currently only `deleteCollection` has retries. With optimistic locking, **every mutation** would need retry logic because any concurrent modification causes a conflict. This is a major expansion of the retry surface area.
- The linear backoff strategy (100ms increments, max 5 retries) might need adjustment — optimistic conflicts could be more frequent than deadlocks, potentially requiring more retries or different backoff.

### E. PubSub Events Aspect — Timing Consideration

The `pubsub-events` aspect states: "Events are published AFTER the database transaction commits successfully." With optimistic locking, transactions are shorter (no lock waits), but retries happen at a higher level. The event publishing logic needs to ensure it only fires after a **successful** commit, not after a failed optimistic attempt. This is likely already the case if events are outside the transaction, but needs verification.

### F. Prisma Layer

- The raw SQL function `lockTeamCollectionByTeamAndParent` would be removed.
- All `updateMany` calls that modify orderIndex ranges would need to include version checks in their WHERE clauses and increment the version in their SET clauses.
- Prisma does not have built-in optimistic locking support, so this would need to be implemented manually (check `affectedRows` count after each update).

---

## 4. Risks the Switch Would Introduce

### High Severity

1. **Impractical for batch updates (acknowledged by the design itself)**: The pessimistic-locking aspect explicitly documents why optimistic was rejected: "Since reorder operations often touch MANY siblings (updateMany with range conditions), optimistic locking would be impractical — a single conflicting row would invalidate the entire batch." This is the fundamental risk — the architecture was explicitly designed around pessimistic locking for good reason.

2. **Starvation under concurrent collaboration**: Hoppscotch is a real-time collaboration tool. Multiple users can modify the same collection tree simultaneously. With optimistic locking, frequent conflicts could cause starvation — operations that touch many siblings (reorder, sort, delete-with-reindex) would repeatedly fail and retry while other operations keep changing versions. The current pessimistic approach serializes access, which guarantees progress.

3. **Two-parent move operations become fragile**: `moveCollection` modifies sibling indexes in both the source and destination parent. With optimistic locking, a conflict in either parent's sibling set would require retrying the entire operation. The conflict probability roughly doubles compared to single-parent operations.

4. **OrderIndex contiguity invariant at risk**: The contiguity constraint (no gaps, no duplicates in orderIndex within a sibling set) is maintained by carefully sequenced reads and writes within a locked transaction. Optimistic locking could allow two operations to read the same state and both attempt to "fill a gap" or "append at end," leading to duplicate or inconsistent indexes even with version checks — especially in batch updateMany scenarios where individual row versions might not be granular enough.

### Medium Severity

5. **Retry explosion**: Currently only delete has retries. With optimistic locking, every mutation needs retries, which means:
   - More code complexity across all 7+ mutation methods
   - Higher latency under contention (retries add up)
   - Harder to reason about correctness (each retry re-reads and re-computes)

6. **Import/duplication reliability degrades**: Recursive import creates collections at multiple tree levels within a transaction. With optimistic locking, a conflict at any level would require restarting the entire import. For large collection trees, this could make imports unreliable under concurrent access.

7. **Performance regression under contention**: While optimistic locking avoids lock waits (improving throughput when there is no contention), it degrades under contention because failed transactions waste work. For a collaborative tool where multiple users edit the same collection tree, contention is the expected case, not the exception.

### Low Severity

8. **Schema migration risk**: Adding a version column to an existing production table requires a migration. If the table is large, this could cause downtime or lock the table during migration (depending on the database engine and migration strategy).

9. **Testing complexity**: The current retry-on-deadlock tests check for specific Prisma error codes. All of these would need to be rewritten to test version-conflict scenarios instead, and new tests would be needed for every mutation method that now has retry logic.

---

## Summary

The switch from pessimistic to optimistic locking would be **architecturally unsound** for this module. The context package contains an explicit architectural decision (in the pessimistic-locking aspect) explaining why pessimistic locking was chosen: batch orderIndex mutations on sibling sets are fundamentally incompatible with per-row optimistic versioning. The TeamCollectionService's core invariant (contiguous integer orderIndex) requires serialized access to sibling sets, which is exactly what pessimistic locking provides.

From this single context package, the affected modules are:
- **TeamCollectionService** (directly) — all 7+ mutation methods
- **Pessimistic-locking aspect** (rewrite or replace)
- **Retry-on-deadlock aspect** (expand scope from 1 method to all mutations)
- **PubSub-events aspect** (verify timing still correct under retry-heavy flow)
- **Any other nodes under `team-collections/`** that inherit the pessimistic-locking aspect (not visible from this context)

**Limitations of this analysis**: I can only see the TeamCollectionService node and its direct dependency (TeamService). Other services that may share the pessimistic-locking aspect (TeamRequestService, TeamEnvironmentsService, etc.) are mentioned in the team-ownership aspect but their locking behavior is not visible from this context package.
