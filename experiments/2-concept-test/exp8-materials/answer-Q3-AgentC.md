# Q3: Impact Analysis -- Switching from Pessimistic Locking to Optimistic Locking

## 1. Current Pessimistic Locking Implementation

The codebase uses explicit row-level pessimistic locking via `SELECT ... FOR UPDATE` queries executed inside Prisma interactive transactions. Two locking helper methods are defined in `PrismaService` (`prisma.service.ts`):

```typescript
// Locks TeamCollection rows by teamID + parentID
async lockTeamCollectionByTeamAndParent(tx, teamId, parentID) {
  // Executes: SELECT "orderIndex" FROM "TeamCollection"
  //           WHERE "teamID" = $1 AND "parentID" = $2 FOR UPDATE
}

// Locks TeamRequest rows by teamID + collectionIDs
async lockTeamRequestByCollections(tx, teamID, collectionIDs) {
  // Executes: SELECT "orderIndex" FROM "TeamRequest"
  //           WHERE "teamID" = $1 AND "collectionID" IN (...) FOR UPDATE
}
```

These are called at the beginning of `$transaction` blocks to acquire exclusive locks on all sibling rows before performing order-sensitive mutations. The locked column is always `orderIndex`, and the scope is always siblings within a container (a parent collection or a target collection).

---

## 2. Modules and Operations That Use Pessimistic Locking

### Module A: `TeamCollectionService` (team-collection.service.ts)

**8 call sites** using `lockTeamCollectionByTeamAndParent`:

| # | Method | Purpose of Lock |
|---|--------|-----------------|
| 1 | `importCollectionsFromJSON` | Lock sibling collections under parent before reading last orderIndex and creating new collections |
| 2 | `createCollection` | Lock sibling collections under parent before reading last orderIndex and creating a new collection |
| 3 | `deleteCollectionAndUpdateSiblingsOrderIndex` | Lock sibling collections before deleting a collection and decrementing sibling orderIndexes |
| 4 | `moveCollection` (source lock) | Lock the source parent's children before decrementing their orderIndexes |
| 5 | `moveCollection` (destination lock) | Lock the destination parent's children before assigning the new orderIndex |
| 6 | `updateCollectionOrder` (move to end) | Lock sibling collections before decrementing orderIndexes and moving collection to end |
| 7 | `updateCollectionOrder` (move to position) | Lock sibling collections before shifting orderIndexes and inserting collection at new position |
| 8 | `sortTeamCollections` | Lock sibling collections before re-assigning all orderIndexes in sorted order |

### Module B: `TeamRequestService` (team-request.service.ts)

**4 call sites** using `lockTeamRequestByCollections`:

| # | Method | Purpose of Lock |
|---|--------|-----------------|
| 1 | `deleteTeamRequest` | Lock sibling requests in collection before deleting and decrementing sibling orderIndexes |
| 2 | `createTeamRequest` | Lock sibling requests in collection before reading last orderIndex and creating a new request |
| 3 | `reorderRequests` (private, called by `moveRequest`) | Lock requests in source and destination collections before shifting orderIndexes and moving the request |
| 4 | `sortTeamRequests` | Lock sibling requests in collection before re-assigning all orderIndexes in sorted order |

### Module C: `TeamService` (team.service.ts)

**0 call sites.** No pessimistic locking is used. All operations (create team, delete team, rename, update role, leave team) use simple Prisma queries without transactions or row locks.

### Module D: `TeamEnvironmentsService` (team-environments.service.ts)

**0 call sites.** No pessimistic locking. All CRUD operations are simple single-row Prisma calls. There is no `orderIndex` concept for environments.

### Module E: `AdminService` (admin.service.ts)

**0 call sites.** This is a facade/orchestrator module that delegates to the other services. It does not directly use locking, but it indirectly depends on locking through calls to `TeamCollectionService`, `TeamRequestService`, etc.

---

## 3. Required Changes Per Module for Optimistic Locking

### 3.1 Schema / Database Layer Changes (Prerequisite)

Add a `version` (integer) column to both `TeamCollection` and `TeamRequest` tables, defaulting to 1. This column will serve as the optimistic lock token.

```prisma
model TeamCollection {
  // ... existing fields ...
  version    Int    @default(1)
}

model TeamRequest {
  // ... existing fields ...
  version    Int    @default(1)
}
```

### 3.2 PrismaService (`prisma.service.ts`)

**Remove entirely:**
- `lockTeamCollectionByTeamAndParent()` method
- `lockTeamRequestByCollections()` method

**Add instead:**
- A generic `optimisticUpdate` helper or rely on each module to implement its own retry-with-version-check pattern.

### 3.3 TeamCollectionService

Every method that currently calls `lockTeamCollectionByTeamAndParent` would need restructuring:

**Pattern Replacement:** Instead of `SELECT ... FOR UPDATE` followed by mutations, each operation must:

1. Read the current rows and their `version` values
2. Perform the mutations with a `WHERE` clause that includes `version = <read_version>`
3. Increment `version` on every write
4. Check the update count -- if 0 rows were updated, a concurrent modification occurred
5. Retry the entire operation from step 1 (the service already has a `MAX_RETRIES = 5` constant and a retry loop in `deleteCollectionAndUpdateSiblingsOrderIndex`, which would need to be generalized to all operations)

**Specific method changes:**

- **`createCollection`**: After reading `lastCollection.orderIndex`, create with `orderIndex: last + 1`. If a concurrent create races, the `UNIQUE` constraint on `(teamID, parentID, orderIndex)` (if one exists) would fail, triggering retry. Without a unique constraint, a separate version check on the parent container or a "count and verify" approach is needed.

- **`deleteCollectionAndUpdateSiblingsOrderIndex`**: Already has a retry loop. Replace the `FOR UPDATE` with a version-checked delete: `DELETE WHERE id = X AND version = Y`. If delete count is 0, retry. The `updateMany` for sibling reindexing becomes more complex because each sibling's version must be checked individually or a bulk version-increment approach is used.

- **`moveCollection`**: The most complex case. Currently acquires locks on both source and destination parent groups. With optimistic locking, the method must read versions of all affected rows (source siblings, destination siblings, the moved collection itself), perform all mutations with version checks, and retry the entire operation if any version mismatch occurs.

- **`updateCollectionOrder`**: Must read the `version` of the collection being moved and all siblings in range, then conditionally update each. Any version mismatch means retry.

- **`importCollectionsFromJSON`**: Must read the last orderIndex with its version, create new entries, and verify no concurrent inserts changed the ordering. Less critical since imports are typically not high-concurrency operations.

- **`sortTeamCollections`**: Must read all collections with their versions, then update each with a version check. If any fails, retry the entire sort.

### 3.4 TeamRequestService

Same pattern as TeamCollectionService, applied to request ordering:

- **`createTeamRequest`**: Read last request's orderIndex + version, create new request, verify no concurrent insert.

- **`deleteTeamRequest`**: Delete with version check, then update sibling orderIndexes with version checks.

- **`reorderRequests` (moveRequest)**: Read versions of all affected requests in source and destination collections, perform order shifts with version checks, retry on conflict. This is especially complex when moving across collections since it involves two sibling groups.

- **`sortTeamRequests`**: Read all requests with versions, update each with version check, retry on any conflict.

### 3.5 TeamService

**No changes required.** This module does not use pessimistic locking and does not manage ordered collections. However, there is one area of concern: `updateTeamAccessRole` reads the owner count and then updates the role in separate queries -- a TOCTOU (time-of-check-time-of-use) race. If optimistic locking were applied comprehensively, a version column on `TeamMember` could guard against concurrent role changes that might leave a team with zero owners.

### 3.6 TeamEnvironmentsService

**No changes required.** No ordering or locking exists in this module.

### 3.7 AdminService

**No direct changes required.** It delegates to the other services. However, integration tests should verify that admin-triggered operations (like team deletion that cascades into collection/request cleanup) still behave correctly under optimistic locking.

---

## 4. Risks of the Switch

### 4.1 High-Contention Starvation

The core reason pessimistic locking was chosen is that `orderIndex` operations are inherently high-contention: every create, delete, move, or reorder in the same sibling group touches multiple rows. Under optimistic locking, if a team has many concurrent users reordering items in the same collection, transactions will fail and retry repeatedly. In the worst case, some operations could starve and never succeed within the retry limit.

The existing `deleteCollectionAndUpdateSiblingsOrderIndex` already handles `TRANSACTION_DEADLOCK` and `TRANSACTION_TIMEOUT` errors with up to 5 retries. Under optimistic locking, **all** ordering operations would need similar retry logic, significantly increasing code complexity.

### 4.2 Multi-Row Atomicity is Lost

Pessimistic locking guarantees that once the `FOR UPDATE` is acquired, no other transaction can modify any sibling's `orderIndex` until the lock is released. This allows complex multi-step reordering (decrement some siblings, increment others, update the target) to execute atomically.

With optimistic locking, each individual row update carries its own version check. If the operation updates 50 sibling orderIndexes and the 49th fails its version check, the transaction must abort and retry -- wasting all work done on the previous 48 updates. The `$transaction` wrapper with Prisma handles rollback, but the retry cost is proportional to the number of siblings.

### 4.3 Move-Across-Collections is Especially Dangerous

`reorderRequests` and `moveCollection` both lock two separate sibling groups (source and destination). With pessimistic locking, deadlocks are managed by PostgreSQL's deadlock detector. With optimistic locking, there is no deadlock, but the probability of a version conflict doubles because two independent groups of rows can independently experience concurrent modifications.

### 4.4 Sort Operations Become Fragile

`sortTeamCollections` and `sortTeamRequests` both read all items in a container, then update every single one with a new `orderIndex`. Under optimistic locking, any concurrent modification to any single item in the container will invalidate the entire sort. For large collections (hundreds of items), the probability of a conflicting concurrent write approaches certainty under any non-trivial load.

### 4.5 Increased Latency from Retries

The existing retry pattern in `deleteCollectionAndUpdateSiblingsOrderIndex` includes an exponential backoff (`delay(retryCount * 100)`). If all ordering operations adopt this pattern, the average latency for order-sensitive mutations will increase, particularly under concurrent access.

### 4.6 PubSub Event Ordering

After a successful mutation, events are published via `this.pubsub.publish(...)`. Under pessimistic locking, events are published after the transaction commits. Under optimistic locking with retries, care must be taken to ensure events are only published after a successful attempt -- not after a failed attempt that will be retried. The current code already handles this correctly (publish is outside the transaction block), but the retry wrapper must be designed to not duplicate event publications.

### 4.7 Cascade Delete Gaps

`TeamService.deleteTeam` performs `deleteMany` on `TeamMember` then `delete` on `Team` without any locking. If collection/request ordering operations are running concurrently during a team deletion, the lack of locking (which was previously provided by database-level foreign key locks) could create orphaned operations or constraint violations.

---

## 5. Summary Recommendation

The pessimistic locking in this codebase is narrowly and correctly applied: it protects `orderIndex` integrity within sibling groups during multi-row mutations inside interactive transactions. The pattern (`SELECT ... FOR UPDATE` at the start of a transaction) is a well-established approach for this exact use case.

Switching to optimistic locking would require:
- Schema changes (version columns on `TeamCollection` and `TeamRequest`)
- Rewriting **12 transaction blocks** across 2 modules
- Adding retry-with-backoff logic to all 12 operations (currently only 1 has it)
- Accepting higher latency and potential starvation under concurrent access
- Significantly more complex error handling (version mismatch detection per row)

The switch would be justified only if the database has a strong reason to avoid row locks (e.g., migrating to a distributed database that does not support `SELECT ... FOR UPDATE`). For a PostgreSQL-backed system with moderate concurrency, pessimistic locking is the more appropriate strategy for ordered-list operations.
