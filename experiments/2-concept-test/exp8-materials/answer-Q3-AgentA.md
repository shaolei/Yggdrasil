# Q3: Impact Analysis -- Switching from Pessimistic Locking to Optimistic Locking

## 1. Nodes Currently Using the Pessimistic-Locking Aspect

From the graph tree and context packages, exactly **two service nodes** and their **two parent module nodes** carry the `pessimistic-locking` aspect:

| Node | Level | Aspect source |
|---|---|---|
| `team-collections/` (module) | hierarchy | `aspects: pessimistic-locking, pubsub-events` |
| `team-collections/team-collection-service` | service | `aspects: pessimistic-locking, pubsub-events, retry-on-deadlock, team-ownership` |
| `team-request/` (module) | hierarchy | `aspects: pessimistic-locking, pubsub-events` |
| `team-request/team-request-service` | service | `aspects: pessimistic-locking, pubsub-events, team-ownership` |

**Not affected directly:**
- `team/team-service` -- no pessimistic-locking aspect (uses pubsub-events, role-based-access only)
- `team-environments/team-environments-service` -- no pessimistic-locking aspect (uses pubsub-events, team-ownership only)
- `admin/admin-service` -- no pessimistic-locking aspect (uses pubsub-events, role-based-access only); it delegates to domain services and does not perform locking itself

## 2. Specific Operations in Each Node That Use Locking

### TeamCollectionService

Every operation that reads-then-modifies sibling `orderIndex` values acquires a row lock via `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`:

| Operation | What is locked | Why |
|---|---|---|
| **createCollection** | Siblings under new parent | Needs to read last orderIndex and assign `lastIndex + 1` |
| **deleteCollection** (`deleteCollectionAndUpdateSiblingsOrderIndex`) | Siblings under deleted collection's parent | Must decrement all siblings with higher orderIndex to fill the gap |
| **moveCollection** (`changeParentAndUpdateOrderIndex`) | Siblings in BOTH source and destination parents | Two-parent operation: fills gap in source, appends in destination |
| **updateCollectionOrder** (reorder) | Siblings under the collection's parent | Shifts ranges of orderIndex up or down depending on move direction |
| **sortCollection** | Siblings under the target parent | Re-assigns all orderIndex values based on sorted title order |
| **importCollectionsFromJSON** | Siblings under each import parent | Recursive import assigns orderIndex for each imported collection |
| **duplicateCollection** | (uses import internally) | Export + re-import pattern, so import-side locking applies |

### TeamRequestService

Uses `prisma.lockTeamRequestByCollections` to lock request rows by collection:

| Operation | What is locked | Why |
|---|---|---|
| **createTeamRequest** | Requests in target collection | Reads last orderIndex, assigns `lastIndex + 1` |
| **deleteTeamRequest** | Requests in the request's collection | Decrements higher siblings to fill the gap |
| **moveRequest** | Requests in BOTH source and destination collections | Multi-collection lock in a single transaction; re-reads positions inside lock to prevent races |
| **sortTeamRequests** | Requests in target collection | Fetches sorted list, reassigns contiguous orderIndex values |

## 3. What Would Need to Change in Each Node

### 3A. Database Schema Changes (Shared / Prisma Level)

- **Add `version` column** to both `TeamCollection` and `TeamRequest` tables. This integer column starts at 1 and is incremented on every write. This is the core mechanism for optimistic locking: every UPDATE includes `WHERE id = ? AND version = ?`, and if no row matches, a conflict is detected.
- **Prisma migration** required to add the column with a default value and backfill existing rows.
- **Remove `lockTeamCollectionByTeamAndParent`** and **`lockTeamRequestByCollections`** raw SQL lock functions from Prisma client extensions. These become dead code.

### 3B. TeamCollectionService Changes

1. **Every read must capture `version`**: All queries that fetch a collection before mutation must SELECT the `version` field. Currently, reads inside transactions do not track versions since the lock guarantees isolation.

2. **Single-row mutations (rename, update data)**: Straightforward -- add `WHERE version = currentVersion` to the UPDATE, increment version. On conflict (0 rows updated), retry.

3. **Batch orderIndex mutations are the hard part**: Operations like `updateCollectionOrder` use `updateMany` with range conditions (e.g., "increment orderIndex for all siblings where orderIndex BETWEEN X AND Y"). Under optimistic locking:
   - Option A: Check versions of ALL siblings before the batch update, then update each individually with version checks. This defeats the purpose of batch operations and is O(N) in writes.
   - Option B: Use a **parent-level version counter** (a version column on the parent collection or a separate `sibling_set_version` table keyed by `(teamID, parentID)`). Every operation that touches sibling order reads and increments this single version. This is more practical than per-row versioning for batch operations but introduces a new table/column.
   - Option C: Keep `updateMany` but validate via a post-update checksum (count + sum of orderIndexes). This is fragile and not a true optimistic lock.

   **Recommendation: Option B** -- a sibling-set-level version counter is the closest analogue to the current `(teamID, parentID)` lock scope.

4. **`createCollection`**: Read sibling-set version, assign `lastIndex + 1`, write with version check. On conflict, retry.

5. **`deleteCollection` + reindex**: Read sibling-set version, delete the row, decrement higher siblings, increment sibling-set version. On conflict, retry. This replaces the current retry-on-deadlock pattern.

6. **`moveCollection`**: Must atomically update TWO sibling sets (source and destination). Each has its own version counter. Both must be checked and incremented. If either conflicts, retry the entire operation. This is significantly more complex than the current approach where a single transaction locks both.

7. **`importCollectionsFromJSON`**: Recursive import creates many collections, each requiring a sibling-set version check. The recursive nature means many potential conflict points during a single import. Retry at the top level would re-do the entire import.

8. **`isParent` (circular reference check)**: This is a read-only tree walk and does not need locking changes. However, under optimistic locking, the tree structure could change between the `isParent` check and the subsequent move. Currently, the pessimistic lock prevents this race. Under optimistic locking, the version check on the final write serves as the guard, but the `isParent` result may be stale. A post-write re-validation or a serializable isolation level transaction may be needed.

9. **Replace `prisma.$transaction` with interactive transactions or manual retry wrappers**: The current pattern opens a transaction and locks rows. The new pattern would be: read state + versions, compute mutations, attempt writes with version conditions, detect conflict (0 rows affected), retry.

### 3C. TeamRequestService Changes

1. **Add `version` to TeamRequest** (or use a collection-level request-set version counter keyed by `collectionID`, analogous to the sibling-set version for collections).

2. **`createTeamRequest`**: Read request-set version for the collection, assign orderIndex, write with version check.

3. **`deleteTeamRequest`**: Read request-set version, delete, decrement siblings, increment version. On conflict, retry.

4. **`moveRequest`**: Currently locks BOTH source and destination collections in one transaction. Under optimistic locking, both collection request-set versions must be read and validated. Conflict on either requires full retry.

5. **`sortTeamRequests`**: Reads all requests in sorted order, reassigns orderIndexes. Under optimistic locking, the version check ensures no concurrent modification occurred during the sort. Conflicts are likely on large collections with active users.

6. **Remove `ConflictException` wrapping**: Currently, locking errors in transactions are wrapped as `ConflictException`. Under optimistic locking, there are no lock-acquisition errors; instead, version mismatches drive retries.

### 3D. Aspect and Cross-Cutting Changes

- **Replace `pessimistic-locking` aspect** with a new `optimistic-locking` aspect that documents the version-check-and-retry pattern.
- **Modify or replace `retry-on-deadlock` aspect**: The current retry-on-deadlock aspect is specific to pessimistic lock deadlocks. Under optimistic locking, deadlocks do not occur. Instead, a more general `retry-on-version-conflict` aspect is needed. The retry conditions change from `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, `TRANSACTION_TIMEOUT` to version-mismatch detection (0 rows updated).
- **PubSub timing**: Currently, events fire after transaction commit. Under optimistic locking, events should fire only after the final successful write (post-retry). This is behaviorally similar but the implementation boundary changes.

### 3E. AdminService (Indirect Impact)

AdminService delegates to TeamCollectionService and TeamRequestService for collection/request operations (e.g., `createTeamCollection`, `deleteTeamCollection`, `createTeamRequest`). It does not perform locking itself. However:
- If the underlying services now return version-conflict errors and retry internally, AdminService sees no change.
- If retry responsibility is pushed up to callers, AdminService would need retry wrappers. **Recommendation: keep retries internal to the domain services.**

## 4. Patterns That Become Obsolete or Need Modification

### Becomes Obsolete

| Pattern | Current role | Why it is no longer needed |
|---|---|---|
| `lockTeamCollectionByTeamAndParent` | Raw SQL row lock on siblings | Replaced by version-check-and-retry |
| `lockTeamRequestByCollections` | Raw SQL row lock on requests in a collection | Replaced by version-check-and-retry |
| `prisma.$transaction` (serializing variant) | Wraps lock + read + mutate in atomic block | No longer needed for locking; may still be used for atomicity of multi-table writes, but without SELECT FOR UPDATE |

### Needs Modification

| Pattern | Current form | New form |
|---|---|---|
| **retry-on-deadlock** (TeamCollectionService delete) | Retries on `TRANSACTION_DEADLOCK`, `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_TIMEOUT` with linear 100ms backoff, max 5 | Retries on **version mismatch** (0 rows updated). Backoff strategy may need to become exponential with jitter since conflicts under optimistic locking are more frequent than deadlocks. Max retries may need increasing. |
| **PubSub event timing** | "After transaction commits" | "After successful write (including retries)" -- semantically similar but retry loop must encapsulate both the write and the conflict check, with PubSub outside the retry loop |
| **Two-parent operations** (moveCollection, moveRequest) | Single transaction locks both sibling sets | Must read versions of both sets, perform writes with version checks on both, and retry if either conflicts. Alternatively, use serializable isolation level for these specific operations. |

### Patterns That Are Currently Missing and Would Be Needed

| New pattern | Purpose |
|---|---|
| **Version column management** | Prisma middleware or wrapper that automatically increments version on every update |
| **Conflict detection utility** | Shared function: perform update with `WHERE version = ?`, check `count` in result, throw `VersionConflictError` if 0 |
| **Retry-on-version-conflict wrapper** | Generic higher-order function that wraps an operation with read-compute-write-retry logic |
| **Sibling-set version table** (if Option B is chosen) | New DB table or column to track version per `(teamID, parentID)` for collections and per `collectionID` for requests |

## 5. Risks Introduced by the Switch

### TeamCollectionService Risks

| Risk | Severity | Explanation |
|---|---|---|
| **Starvation on high-contention sibling sets** | HIGH | A popular collection with many children being reordered by multiple users could cause repeated version conflicts. Unlike pessimistic locking (which queues operations), optimistic locking forces retries that may repeatedly fail. The current linear backoff (max 1.5s total) may be insufficient. |
| **Import reliability degradation** | HIGH | `importCollectionsFromJSON` performs recursive creation of potentially hundreds of collections. Each creation touches a sibling-set version. A single concurrent edit to any parent in the tree causes the entire import to conflict and retry. The retry would re-do the entire recursive import, which is expensive. |
| **Stale `isParent` check** | MEDIUM | The circular-reference check walks the tree without locks. Under pessimistic locking, the subsequent locked transaction prevents the tree from changing. Under optimistic locking, the tree could change between `isParent` and the final write. The version check catches this only if the moved collection's sibling set was modified -- but the circular reference might be created by a change in a DIFFERENT sibling set. |
| **Duplication atomicity** | MEDIUM | Duplication uses export-then-import. The export reads the tree (potentially stale), then the import creates new collections. Concurrent modifications between export and import could cause the duplicate to reflect a partially modified original. Under pessimistic locking, the import transaction locks each sibling set. |
| **Two-parent move complexity** | MEDIUM | `moveCollection` modifies sibling indexes in both source and destination parents. Under optimistic locking, both sibling-set versions must be validated. The probability of conflict doubles (either parent's version may conflict), and retries must re-read both parents. |

### TeamRequestService Risks

| Risk | Severity | Explanation |
|---|---|---|
| **Cross-collection move races** | HIGH | `moveRequest` locks both source and destination collections. Under optimistic locking, a concurrent create/delete in either collection causes a version conflict. In a real-time collaborative tool where multiple users edit the same team's collections, this is a frequent scenario. |
| **Sort conflicts** | MEDIUM | `sortTeamRequests` reassigns all orderIndexes in a collection. Any concurrent request creation or deletion in that collection invalidates the sort. Under pessimistic locking, the sort holds the lock for the duration. Under optimistic locking, the sort must retry entirely. |
| **ConflictException removal** | LOW | The current `ConflictException` wrapping for locking errors is well-understood. Replacing it with version-conflict detection requires careful error handling to distinguish "version mismatch" from "record not found" from "constraint violation." |

### System-Wide Risks

| Risk | Severity | Explanation |
|---|---|---|
| **Behavioral regression in real-time collaboration** | HIGH | Hoppscotch is explicitly described as a "real-time collaboration tool." The pessimistic locking aspect documentation states that pessimistic locking was deliberately chosen because "reorder operations often touch MANY siblings" and "a single conflicting row would invalidate the entire batch." Switching to optimistic locking contradicts the original architectural decision and its documented rationale. |
| **Migration complexity** | MEDIUM | Adding version columns to existing tables with production data requires a non-trivial migration. All existing rows need a default version (1). The `lockTeamCollectionByTeamAndParent` and `lockTeamRequestByCollections` functions must be removed or deprecated. |
| **Testing surface area** | MEDIUM | The current test surface covers deadlock retries and transaction isolation. Under optimistic locking, the test surface shifts to version-conflict retries, stale-read scenarios, and multi-set conflict handling. All existing concurrency tests must be rewritten. |
| **Performance under contention** | MEDIUM-HIGH | Pessimistic locking guarantees progress: one transaction holds the lock and completes. Optimistic locking does not guarantee progress under contention -- multiple writers may repeatedly conflict, leading to livelock scenarios. This is especially concerning for batch operations (import, sort) on collections with many children. |
| **PubSub event ordering** | LOW | Under pessimistic locking, transactions serialize, so PubSub events arrive in a deterministic order. Under optimistic locking, retries may cause events to arrive out of order relative to the actual mutation sequence. The UI must be resilient to this. |

## Summary

The switch from pessimistic to optimistic locking affects **two modules directly** (TeamCollectionService and TeamRequestService) and would require:

1. Schema migration (version columns or sibling-set version table)
2. Removal of raw SQL lock functions
3. New retry-on-version-conflict infrastructure
4. Rewrite of all order-modifying operations in both services
5. Special handling for multi-parent operations (move collection, move request)
6. Replacement of the retry-on-deadlock aspect with retry-on-version-conflict
7. Careful treatment of the `isParent` circular-reference check
8. Complete rewrite of concurrency tests

The original architecture explicitly chose pessimistic locking with documented rationale ("optimistic locking would be impractical -- a single conflicting row would invalidate the entire batch"). The switch contradicts this rationale and introduces significant risks for a real-time collaborative tool, particularly around import operations, cross-parent moves, and high-contention sibling sets. If the switch is pursued despite these risks, a sibling-set-level version counter (rather than per-row versioning) is the most practical approach.
