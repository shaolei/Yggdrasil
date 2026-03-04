# M4 Drift Recovery Report: TeamCollectionService

## Drift Classification: MAJOR ARCHITECTURAL CHANGE

The concurrency control strategy has been fundamentally replaced. This is not an incremental change -- it is a paradigm shift from **pessimistic locking** to **optimistic concurrency control (OCC)**.

---

## 1. Executive Summary of Changes

The source code has undergone a sweeping architectural change affecting every mutation method in the service. The core shift:

| Dimension | BEFORE (Graph) | AFTER (Source) |
|---|---|---|
| Concurrency model | Pessimistic row locking via `lockTeamCollectionByTeamAndParent()` | Optimistic concurrency via version columns + snapshot/verify pattern |
| Lock mechanism | `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` -- SELECT FOR UPDATE | `readSiblingVersions()` + `verifySiblingVersions()` -- version column comparison |
| Conflict detection | Deadlock (database-level) | `ConflictException` with `TEAM_COLL_STALE_VERSION` (application-level) |
| Retry strategy | Retry loop with linear backoff on deadlock/timeout/unique-constraint errors | No retry loop; single attempt, immediate failure on version mismatch |
| New error codes | N/A | `TEAM_COLL_STALE_VERSION`, `TEAM_COLL_CREATION_FAILED` |
| Removed mechanisms | N/A | `lockTeamCollectionByTeamAndParent()` call removed entirely |
| DB schema dependency | No version column needed | Requires `version` column on `TeamCollection` table |

---

## 2. Artifact-by-Artifact BEFORE and AFTER

### 2.1 node.yaml

**BEFORE:**
```yaml
name: TeamCollectionService
type: service
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]
```

**AFTER (required):**
```yaml
name: TeamCollectionService
type: service
aspects: [optimistic-concurrency, pubsub-events]
```

**Changes:**
- REMOVE aspect `pessimistic-locking` -- no longer used anywhere in the code
- REMOVE aspect `retry-on-deadlock` -- retry loop has been completely removed
- ADD aspect `optimistic-concurrency` (new aspect, see section 5)

---

### 2.2 constraints.md

**BEFORE:**
```markdown
## Circular reference prevention
(unchanged)

## OrderIndex contiguity
(unchanged)

## Same-team constraint
(unchanged)

## Self-move prevention
(unchanged)

## Already-root guard
(unchanged)

## Title minimum length
(unchanged)

## Data field validation
(unchanged)
```

**AFTER (required additions):**

All existing constraints remain valid and unchanged in the code. However, a new constraint must be added:

```markdown
## Optimistic concurrency on sibling sets

Every mutation that modifies sibling orderIndex values (create, delete, move, reorder, sort, import)
reads a snapshot of sibling version numbers at the start of the transaction via `readSiblingVersions()`,
then verifies none have changed at the end via `verifySiblingVersions()`. If any sibling's version
has been incremented by a concurrent transaction, the operation throws `ConflictException` with
`TEAM_COLL_STALE_VERSION` and aborts. The caller receives `E.left(TEAM_COLL_STALE_VERSION)`.

This replaces the previous pessimistic row locking mechanism. The version column is maintained
by the database (auto-incremented on every update to a TeamCollection row).
```

Also add:

```markdown
## Move operation: dual-parent version checking

The `moveCollection` method reads sibling versions for BOTH the source parent and the destination
parent before performing the move. After the move completes, it verifies versions for both parent
sibling sets. This prevents races where concurrent modifications to either the source or
destination sibling set could corrupt orderIndex contiguity.
```

---

### 2.3 decisions.md

**BEFORE:**
All five existing decisions remain valid:
- Why duplication uses export + import (UNCHANGED in code)
- Why search uses raw SQL instead of Prisma query builder (UNCHANGED in code)
- Why parent tree reconstruction uses recursive CTE (UNCHANGED in code)
- Why `isParent` walks up, not down (UNCHANGED in code)
- Why orderIndex is integer-based, not fractional (UNCHANGED in code)

**AFTER (required additions):**

```markdown
## Why optimistic concurrency replaced pessimistic locking

The previous approach used `lockTeamCollectionByTeamAndParent()` (SELECT FOR UPDATE) to acquire
row-level locks on all siblings before mutating orderIndex values. This caused database-level
deadlocks when concurrent operations targeted the same sibling set, requiring a retry loop with
linear backoff.

The new approach reads a version snapshot (`readSiblingVersions`) at transaction start and verifies
it at transaction end (`verifySiblingVersions`). If a concurrent transaction modified any sibling
(incrementing its version), the check throws `ConflictException` and the transaction rolls back.

Trade-offs:
- Pro: eliminates database deadlocks entirely (no row locks held across transaction)
- Pro: removes the retry loop and its complexity (MAX_RETRIES, backoff delays)
- Pro: reduces lock contention and improves throughput under moderate concurrency
- Con: under high write contention on the same sibling set, more transactions will fail
  and need to be retried by the caller (the service itself no longer retries)
- Con: requires a `version` column in the schema, adding storage overhead per row
- Con: shifts retry responsibility to the caller (resolver/controller layer)

## Why delete no longer has a retry loop

The previous delete implementation (`deleteCollectionAndUpdateSiblingsOrderIndex`) had a retry
loop because pessimistic locks could deadlock when two concurrent deletes targeted the same
sibling set. With optimistic concurrency, there are no row-level locks to deadlock on. A version
mismatch simply causes the transaction to abort with `TEAM_COLL_STALE_VERSION`. The retry
responsibility is shifted to the caller, if retry behavior is desired.

## Why `createCollection` catches ConflictException separately from other errors

The `createCollection` method distinguishes between `ConflictException` (which indicates a
concurrent modification detected by the optimistic lock, returning `TEAM_COLL_STALE_VERSION`)
and all other errors (returning `TEAM_COLL_CREATION_FAILED`). This provides distinct error
codes so callers can decide whether to retry (stale version) or report a hard failure.
```

**REMOVE:**

```markdown
## Why delete has retries but other mutations do not
```

This decision is no longer valid. Delete no longer has retries. The entire retry-on-deadlock mechanism has been removed.

---

### 2.4 logic.md

**BEFORE:**

```markdown
## Reorder algorithm (updateCollectionOrder)
(step-by-step with "Lock siblings" as step 1)

## isParent (circular reference check)
(unchanged)

## Move collection (changeParentAndUpdateOrderIndex)
(step 1-3, no version checking mentioned)
```

**AFTER (required changes):**

#### Reorder algorithm -- Move to end

```markdown
### Move to end (nextCollectionID = null)

1. Read sibling versions snapshot (optimistic lock)
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)
5. Verify sibling versions unchanged (optimistic lock check)
```

Change: Step 1 changed from "Lock siblings" to "Read sibling versions snapshot". Step 5 added.

#### Reorder algorithm -- Move to specific position

```markdown
### Move to specific position (nextCollectionID != null)

1. Read sibling versions snapshot (optimistic lock)
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range [nextCollection.orderIndex, collection.orderIndex - 1]
5. If moving DOWN: decrement all siblings in range [collection.orderIndex + 1, nextCollection.orderIndex - 1]
6. Set collection's orderIndex to: if moving up -> nextCollection.orderIndex, if moving down -> nextCollection.orderIndex - 1
7. Verify sibling versions unchanged (optimistic lock check)
```

Change: Step 1 changed from "Lock siblings" to "Read sibling versions snapshot". Step 7 added.

#### isParent -- UNCHANGED

No changes needed. The algorithm is identical.

#### Move collection (changeParentAndUpdateOrderIndex) -- UNCHANGED internally

The method itself is unchanged. However, the CALLER (`moveCollection`) now wraps it with optimistic version checking on both source and destination parents:

```markdown
## Move collection (moveCollection orchestration)

1. Read collection inside transaction
2. Read sibling versions for SOURCE parent
3. Validate guards (already-root, self-move, same-team, circular reference)
4. If moving into another collection: read sibling versions for DESTINATION parent
5. Call changeParentAndUpdateOrderIndex (unchanged: find last index, decrement source siblings, update parent+orderIndex)
6. Verify sibling versions for source parent
7. If destination parent: verify sibling versions for destination parent
8. Publish PubSub event
```

#### NEW: Delete algorithm

```markdown
## Delete algorithm (deleteCollectionAndUpdateSiblingsOrderIndex)

1. Read sibling versions snapshot (optimistic lock)
2. Delete the collection
3. Decrement orderIndex of all siblings with orderIndex > deleted collection's orderIndex
4. Verify sibling versions unchanged (optimistic lock check)
5. If ConflictException: return E.left(TEAM_COLL_STALE_VERSION)
6. If other error: return E.left(TEAM_COL_REORDERING_FAILED)
```

Change: The retry loop (MAX_RETRIES=5, linear backoff) has been completely removed. The method now makes a single attempt.

#### NEW: Create algorithm

```markdown
## Create algorithm (createCollection)

1. Validate title length, parent ownership, data JSON
2. Open transaction
3. Read sibling versions snapshot (optimistic lock)
4. Find last orderIndex under parent
5. Create collection with orderIndex = last + 1
6. Verify sibling versions unchanged (optimistic lock check)
7. If ConflictException: return E.left(TEAM_COLL_STALE_VERSION)
8. If other error: return E.left(TEAM_COLL_CREATION_FAILED)
9. Publish PubSub `coll_added` event
```

#### NEW: Import algorithm change

```markdown
## Import algorithm (importCollectionsFromJSON)

1. Parse and validate JSON
2. Open transaction
3. Read sibling versions snapshot (optimistic lock)
4. Find last orderIndex under parent
5. Generate Prisma create objects with incremented orderIndex
6. Create all collections (Promise.all)
7. Verify sibling versions unchanged (optimistic lock check)
8. If ConflictException: return E.left(TEAM_COLL_STALE_VERSION)
9. If other error: return E.left(TEAM_COLL_CREATION_FAILED)
10. Publish PubSub `coll_added` events for each created collection
```

#### NEW: Sort algorithm change

```markdown
## Sort algorithm (sortTeamCollections)

1. Open transaction
2. Read sibling versions snapshot (optimistic lock)
3. Fetch all siblings ordered by sort criteria (title asc/desc or current orderIndex)
4. Reassign orderIndex 1..N based on new order
5. Verify sibling versions unchanged (optimistic lock check)
6. If ConflictException: return E.left(TEAM_COLL_STALE_VERSION)
7. If other error: return E.left(TEAM_COL_REORDERING_FAILED)
```

---

### 2.5 responsibility.md

**BEFORE:**
```
The central service for all team collection operations. Coordinates Prisma database
transactions with pessimistic row locking, maintains orderIndex consistency across
sibling sets, prevents circular tree structures, and publishes real-time PubSub events
after every mutation.
```

**AFTER (required):**
```
The central service for all team collection operations. Coordinates Prisma database
transactions with optimistic concurrency control (version-based), maintains orderIndex
consistency across sibling sets, prevents circular tree structures, and publishes
real-time PubSub events after every mutation.
```

Change: "pessimistic row locking" -> "optimistic concurrency control (version-based)"

---

## 3. New Private Methods Added to Service

Two new private methods have been added that form the core of the optimistic concurrency mechanism:

### `readSiblingVersions(tx, teamID, parentID): Promise<Map<string, number>>`
- Reads all siblings under a given parent within a transaction
- Returns a Map of collectionID -> version number
- This is the "snapshot" step of the optimistic lock pattern

### `verifySiblingVersions(tx, teamID, parentID, expectedVersions): Promise<void>`
- Re-reads all siblings and compares their current version to the expected snapshot
- If any version has changed, throws `ConflictException(TEAM_COLL_STALE_VERSION)`
- This is the "verify" step of the optimistic lock pattern

These methods are called in every mutation that touches sibling orderIndex values:
- `createCollection`
- `importCollectionsFromJSON`
- `deleteCollectionAndUpdateSiblingsOrderIndex`
- `moveCollection`
- `updateCollectionOrder` (both branches)
- `sortTeamCollections`

---

## 4. New Error Codes

| Error Code | Source | Usage |
|---|---|---|
| `TEAM_COLL_STALE_VERSION` | New import from `../errors` | Returned when optimistic lock detects concurrent modification |
| `TEAM_COLL_CREATION_FAILED` | New import from `../errors` | Returned when collection creation fails for non-concurrency reasons |

---

## 5. Aspect Analysis

### Aspects That Must Be REMOVED

#### `pessimistic-locking`

**Status: INVALID -- must be removed or archived**

The entire aspect is no longer applicable. Specifically:
- `lockTeamCollectionByTeamAndParent()` is never called anywhere in the new code
- There are no `SELECT FOR UPDATE` operations
- The pattern described (open transaction -> lock rows -> read -> mutate -> commit) is no longer followed
- The rationale ("optimistic locking would be impractical -- a single conflicting row would invalidate the entire batch") has been directly contradicted: the new code does exactly this, and apparently the team decided the trade-off is acceptable

**Action:** Remove from `aspects/pessimistic-locking/` or archive with a note explaining it was superseded.

#### `retry-on-deadlock`

**Status: INVALID -- must be removed or archived**

The entire retry mechanism has been removed:
- No `MAX_RETRIES` constant exists
- No retry loop exists
- No linear backoff exists
- No check for `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, or `TRANSACTION_TIMEOUT` error codes
- `deleteCollectionAndUpdateSiblingsOrderIndex` now makes a single attempt and returns immediately on failure
- The `PrismaError` import still exists but is not used for retry logic

**Action:** Remove from `aspects/retry-on-deadlock/` or archive with a note explaining it was superseded by optimistic concurrency which eliminates the deadlock scenario.

### Aspects That Remain VALID

#### `pubsub-events`

**Status: VALID -- no changes needed**

All PubSub patterns remain identical:
- Channel naming convention is unchanged
- Events are still published AFTER transaction commits
- Payload shapes are unchanged
- All five event types are still emitted (`coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated`)

### Aspects That Must Be CREATED

#### `optimistic-concurrency` (NEW)

**Recommended content:**

```markdown
# Optimistic Concurrency Control

Every operation that reads and then modifies sibling orderIndex values uses optimistic
concurrency control via version columns. This replaces the previous pessimistic row locking
approach.

## Pattern

1. Open a `prisma.$transaction`
2. Call `readSiblingVersions(tx, teamID, parentID)` -- reads all sibling version numbers
   into a Map<collectionID, version>
3. Perform mutations (create, delete, update orderIndex)
4. Call `verifySiblingVersions(tx, teamID, parentID, expectedVersions)` -- re-reads all
   siblings and checks that no version has changed
5. If any version changed: throws `ConflictException(TEAM_COLL_STALE_VERSION)`, transaction
   rolls back
6. If no version changed: transaction commits

## Why optimistic, not pessimistic

The previous pessimistic approach (SELECT FOR UPDATE on sibling rows) caused database-level
deadlocks when concurrent operations targeted the same sibling set. This required a retry loop
with linear backoff, adding complexity. Optimistic concurrency eliminates deadlocks entirely
by not holding row-level locks. The trade-off is that under high contention, more transactions
will fail and need to be retried by the caller.

## Scope

The version check is scoped to `(teamID, parentID)` -- it checks siblings, not the entire
team's collections. Operations on different subtrees do not interfere with each other.

For move operations, version checks are performed on BOTH the source and destination parent
sibling sets, since both are modified during a move.

## Error handling

- `ConflictException` with `TEAM_COLL_STALE_VERSION` -- version mismatch detected, caller
  should retry
- The service does NOT retry internally. Retry responsibility is delegated to the caller
  (resolver/controller layer).

## Schema dependency

Requires a `version` integer column on the `TeamCollection` table, auto-incremented on
every update.
```

---

## 6. Hierarchy-Level Artifact Changes

### `team-collections/responsibility.md` (parent node)

The parent responsibility mentions:
> "integer-based sibling ordering, and real-time collaboration via PubSub events"

This remains accurate. However, the aspects listed at the hierarchy level need updating:

**BEFORE:** `aspects="pessimistic-locking,pubsub-events"`

**AFTER:** `aspects="optimistic-concurrency,pubsub-events"`

---

## 7. Relations

No new service dependencies have been added or removed:
- `PrismaService` -- still injected (unchanged)
- `PubSubService` -- still injected (unchanged)
- `TeamService` -- still injected (unchanged)

The `PrismaError` import remains but is no longer used for retry logic. It may be used elsewhere in the codebase. No relation change needed.

---

## 8. Methods Unchanged in Logic

The following methods have NO logic changes and need no artifact updates:
- `generatePrismaQueryObjForFBCollFolder` -- unchanged
- `exportCollectionToJSONObject` -- unchanged
- `exportCollectionsToJSON` -- unchanged
- `cast` -- unchanged
- `getTeamOfCollection` -- unchanged
- `getParentOfCollection` -- unchanged
- `getChildrenOfCollection` -- unchanged
- `getTeamRootCollections` -- unchanged
- `getCollection` -- unchanged (already accepted optional tx parameter)
- `isOwnerCheck` -- unchanged
- `renameCollection` -- unchanged (never used locking, still doesn't)
- `updateTeamCollection` -- unchanged (never used locking, still doesn't)
- `isParent` -- unchanged
- `changeParentAndUpdateOrderIndex` -- unchanged internally (caller changed)
- `getCollectionCount` -- unchanged (already accepted optional tx parameter)
- `totalCollectionsInTeam` -- unchanged
- `getTeamCollectionsCount` -- unchanged
- `searchByTitle` -- unchanged
- `searchCollections` -- unchanged
- `searchRequests` -- unchanged
- `fetchParentTree` -- unchanged
- `fetchCollectionParentTree` -- unchanged
- `fetchRequestParentTree` -- unchanged
- `generateParentTree` -- unchanged
- `getAllRequestsInCollection` -- unchanged
- `getCollectionTreeForCLI` -- unchanged
- `getCollectionForCLI` -- unchanged
- `duplicateTeamCollection` -- unchanged (delegates to importCollectionsFromJSON which changed)

---

## 9. Summary of Required Graph Updates

| Action | Target | Description |
|---|---|---|
| REMOVE aspect | `pessimistic-locking` | No longer used anywhere in code |
| REMOVE aspect | `retry-on-deadlock` | Retry loop completely removed |
| CREATE aspect | `optimistic-concurrency` | New concurrency pattern used by all mutations |
| UPDATE | `node.yaml` | Replace aspect list: `[optimistic-concurrency, pubsub-events]` |
| UPDATE | `constraints.md` | Add optimistic concurrency constraint + dual-parent version checking |
| UPDATE | `decisions.md` | Add 3 new decisions; remove 1 obsolete decision |
| UPDATE | `logic.md` | Replace "Lock siblings" with "Read sibling versions snapshot" in all algorithms; add verify step; add create/import/sort/delete algorithm descriptions; remove retry loop from delete |
| UPDATE | `responsibility.md` | "pessimistic row locking" -> "optimistic concurrency control (version-based)" |
| UPDATE | parent `responsibility.md` | Update hierarchy aspects |
| RUN | `yg drift-sync` | After all updates are applied |

---

## 10. Risk Assessment

**High risk:** The `pessimistic-locking` aspect rationale section previously stated: "Optimistic locking (version columns + retry on conflict) would require every collection row to carry a version field and every read to include it. Since reorder operations often touch MANY siblings, optimistic locking would be impractical." The new code directly contradicts this documented rationale. This means either:

1. The team discovered the concern was overstated and optimistic locking works fine in practice, OR
2. The change was made without awareness of the documented rationale

**Recommendation:** This architectural decision reversal should be explicitly documented in `decisions.md` (draft provided above in section 2.3) and the user/architect should be asked to confirm the rationale for the switch before finalizing the graph update. The old rationale against optimistic locking was well-reasoned and specific -- its contradiction deserves an explicit explanation.
