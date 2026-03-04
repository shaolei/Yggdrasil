# TeamCollectionService

Service module for managing hierarchical team collections in Hoppscotch.

**File:** `packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`
**Framework:** NestJS (TypeScript, Node.js)
**ORM:** Prisma
**Error handling:** fp-ts Either/Option (never throw for business errors)

## Overview

TeamCollectionService is the central service for all team collection operations. It coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

Collections form a tree hierarchy where each collection has a `parentID` (null for root collections) and an integer `orderIndex` that defines its position among siblings. The tree supports arbitrary nesting depth.

### In Scope

- **Collection CRUD:** Create, rename, update (title/data), delete with sibling reindexing
- **Tree operations:** Move collection (to root or into another collection), reorder siblings, sort siblings by title
- **Tree integrity:** Recursive ancestor check (`isParent`) to prevent circular moves
- **Import/Export:** Recursive JSON serialization and deserialization of entire collection subtrees
- **Search:** Raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction (breadcrumb paths)
- **Duplication:** Export-then-import with title modification
- **CLI support:** `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access

### Out of Scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections (separate TeamRequest service)
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)

## Architecture

### Class Structure

```
TeamCollectionService
  Dependencies (injected):
    - PrismaService (database access)
    - PubSubService (real-time event publishing)
    - TeamService (team membership verification)

  Constants:
    - TITLE_LENGTH = 1 (minimum title length)
    - MAX_RETRIES = 5 (retry limit for delete operations)

  Public Methods:
    - createCollection(teamID, title, data, parentID)
    - deleteCollection(collectionID)
    - moveCollection(collectionID, destCollectionID)
    - updateCollectionOrder(collectionID, nextCollectionID)
    - updateTeamCollection(collectionID, data, title)
    - renameCollection(collectionID, newTitle) [deprecated]
    - importCollectionsFromJSON(jsonString, teamID, parentID)
    - exportCollectionToJSONObject(teamID, collectionID)
    - exportCollectionsToJSON(teamID)
    - duplicateTeamCollection(collectionID)
    - sortTeamCollections(teamID, parentID, sortBy)
    - searchByTitle(searchQuery, teamID, take, skip)
    - getCollection(collectionID, tx?)
    - getTeamOfCollection(collectionID)
    - getParentOfCollection(collectionID)
    - getChildrenOfCollection(collectionID, cursor, take)
    - getTeamRootCollections(teamID, cursor, take)
    - getCollectionCount(collectionID, teamID, tx?)
    - totalCollectionsInTeam(teamID)
    - getTeamCollectionsCount()
    - getCollectionForCLI(collectionID, userUid)

  Private Methods:
    - generatePrismaQueryObjForFBCollFolder(folder, teamID, orderIndex)
    - cast(teamCollection)
    - isOwnerCheck(collectionID, teamID)
    - changeParentAndUpdateOrderIndex(tx, collection, newParentID)
    - isParent(collection, destCollection, tx?)
    - deleteCollectionAndUpdateSiblingsOrderIndex(collection, orderIndexCondition, dataCondition)
    - searchCollections(searchQuery, teamID, take, skip)
    - searchRequests(searchQuery, teamID, take, skip)
    - fetchParentTree(searchResult)
    - fetchCollectionParentTree(id)
    - fetchRequestParentTree(id)
    - generateParentTree(parentCollections)
    - getAllRequestsInCollection(collectionID)
    - getCollectionTreeForCLI(parentID)
```

### Data Model

Each `TeamCollection` record has:
- `id` (string, primary key)
- `title` (string, min 1 character)
- `teamID` (string, foreign key to Team)
- `parentID` (string | null, foreign key to parent TeamCollection; null = root)
- `orderIndex` (integer, position among siblings, contiguous from 1)
- `data` (JSON | null, optional metadata/headers)

## Concurrency Strategy

### Why Pessimistic Locking (Not Optimistic)

Every operation that reads and then modifies sibling orderIndex values acquires a pessimistic row lock first. The lock is acquired by calling:

```typescript
await prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID);
```

This locks all sibling rows under the given parent for the duration of the transaction.

**Why not optimistic locking?** Optimistic locking (version columns + retry on conflict) would require every collection row to carry a version field. Since reorder operations often touch MANY siblings via `updateMany` with range conditions, a single conflicting row would invalidate the entire batch. Pessimistic locking serializes access at the correct granularity -- the sibling set.

**Lock scope:** The lock is scoped to `(teamID, parentID)`, meaning it locks siblings, not the entire team's collections. Operations on different subtrees proceed in parallel.

**Standard pattern for all order-modifying operations:**

1. Open a `prisma.$transaction`
2. Call `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`
3. Read current state (last orderIndex, collection positions, etc.)
4. Perform mutations (create, delete, update orderIndex)
5. Transaction commits, releasing locks

## Key Algorithms

### Reorder: Range-Shift Algorithm (`updateCollectionOrder`)

The reorder operation uses "next collection" semantics: the client specifies "place me just before this collection" (or null for "move to end").

**Move to end** (nextCollectionID = null):

1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (guards against race conditions where orderIndex changed between initial read and lock acquisition)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

**Move to specific position** (nextCollectionID != null):

1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up, `nextCollection.orderIndex`; if moving down, `nextCollection.orderIndex - 1`

**Why range-shift, not swap?** Swap only works for adjacent items. Range-shift handles any distance in a single transaction. It also maintains the contiguity invariant -- no gaps, no duplicates.

### Move Between Parents (`moveCollection` + `changeParentAndUpdateOrderIndex`)

Moving a collection to a different parent is a **two-parent operation** within a single transaction:

1. Find last orderIndex under the new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

Both the source and destination parent sibling sets are modified.

**Constraints enforced before move:**

- Cannot move root collection to root (no-op prevention: `TEAM_COL_ALREADY_ROOT`)
- Cannot move collection into itself (`TEAM_COLL_DEST_SAME`)
- Cannot cross teams (`TEAM_COLL_NOT_SAME_TEAM`)
- Cannot move into own descendant -- cycle detection via `isParent`

### Cycle Detection: Walk-Up Algorithm (`isParent`)

To check if moving Collection_A into Collection_D would create a cycle, the algorithm walks UP from D to root:

1. If source === destination: invalid (self-move)
2. If destination.parentID === source.id: invalid (source is ancestor of destination, cycle would form)
3. If destination.parentID is not null: recurse with destination = destination.parent
4. If destination.parentID is null: reached root without finding source, move is safe

**Why walk up, not down?** Walking up follows a single chain of parentID pointers -- O(depth). Walking down would require loading the entire subtree rooted at the source -- O(subtree_size). Tree depth is typically 5-10 levels; subtree size can be hundreds or thousands.

Return values (fp-ts Option):
- `O.none` = invalid (would create cycle)
- `O.some(true)` = valid (safe to move)

### Delete with Reindexing (`deleteCollection`)

1. Fetch the collection
2. Delete the collection (cascading deletes remove children/requests via DB constraints)
3. Decrement orderIndex of all siblings with `orderIndex > deleted.orderIndex` by 1

This maintains the contiguity invariant by filling the gap left by the deletion.

### Duplication: Export+Import (`duplicateTeamCollection`)

Rather than implementing a separate deep-copy method:

1. Export the collection to a `CollectionFolder` JSON object (`exportCollectionToJSONObject`)
2. Modify the title by appending `" - Duplicate"`
3. Re-import via `importCollectionsFromJSON` into the same parent

This reuses the existing recursive import logic (which handles nested children, requests, locking, and orderIndex assignment) without duplicating any code. The trade-off is a serialization round-trip, but it eliminates a separate code path that would need to maintain parity with import logic.

## Design Decisions

### Why Integer orderIndex, Not Fractional

Integer orderIndex with gap-filling (decrement on delete, shift on reorder) requires touching multiple rows on every mutation but guarantees contiguous, predictable indexes. Fractional ordering avoids touching siblings but eventually requires rebalancing when floating-point precision is exhausted. For a real-time collaborative tool where consistency matters more than write throughput, integer ordering is simpler to reason about. The contiguous 1..N invariant also enables reliable cursor-based pagination.

### Why Export+Import for Duplication

A dedicated deep-copy method would duplicate the recursive tree-walking, ID generation, orderIndex assignment, and locking logic that already exists in the import path. Maintaining two parallel implementations of the same algorithm is a bug factory. The serialization round-trip overhead is negligible compared to the maintenance cost of a separate code path.

### Why Walk-Up for Cycle Detection

Walking up from destination to root is O(depth) and follows a single chain of parentID pointers. Walking down from source through all descendants is O(subtree_size) and requires loading an arbitrarily large subtree. Tree depth is bounded in practice (typically 5-10 levels).

### Why Search Uses Raw SQL

The search requires PostgreSQL-specific features: `ILIKE` for case-insensitive matching, the `similarity()` function for fuzzy ranking, and `escapeSqlLikeString` for safe wildcard injection. Prisma's query builder does not expose `similarity()` or custom ordering by a function result. Raw SQL is the only option.

### Why Parent Tree Reconstruction Uses Recursive CTE

After finding search matches, the UI needs breadcrumb paths (e.g., "Parent > Child > Match"). A single `WITH RECURSIVE` CTE fetches the entire ancestor chain in one query, which is critical for performance when search returns many results (compared to N queries per result to walk up the tree).

## Cross-Cutting Concerns

### PubSub Event Emission

Every mutation publishes a PubSub event so connected clients (GraphQL subscriptions) receive real-time updates.

**Channel naming convention:**

| Channel | Trigger |
|---------|---------|
| `team_coll/${teamID}/coll_added` | Collection created or imported |
| `team_coll/${teamID}/coll_updated` | Title or data changed |
| `team_coll/${teamID}/coll_removed` | Collection deleted |
| `team_coll/${teamID}/coll_moved` | Collection moved to different parent |
| `team_coll/${teamID}/coll_order_updated` | Sibling order changed |

**Timing rule:** Events are published AFTER the database transaction commits successfully. This prevents phantom events where a client sees an update but the transaction rolled back. The PubSub publish calls are placed outside the `prisma.$transaction` block.

**Payload shapes:**
- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string (collection no longer exists)
- Order updated: `{ collection, nextCollection }` pair

### Retry Strategy

Only `deleteCollectionAndUpdateSiblingsOrderIndex` uses a retry loop. Other mutations rely solely on pessimistic locking.

**Why only delete?** Delete+reindex can race with concurrent deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. When lock acquisition order differs, a deadlock occurs. Create and move operations are less prone because they modify non-overlapping index ranges.

**Retry conditions** (Prisma error codes):
- `UNIQUE_CONSTRAINT_VIOLATION` -- two operations assigned the same orderIndex
- `TRANSACTION_DEADLOCK` -- two transactions locked rows in conflicting order
- `TRANSACTION_TIMEOUT` -- lock wait exceeded timeout
- Any other error: NOT retried (non-transient problem)

**Backoff strategy:** Linear at `retryCount * 100ms` (100, 200, 300, 400, 500ms). Maximum 5 retries, maximum total wait 1.5 seconds. Linear (not exponential) because the lock contention window is short and linear provides sufficient jitter.

**On exhaustion:** Returns `E.left(TEAM_COL_REORDERING_FAILED)`.

## Known Limitations

1. **No PubSub event for sort:** The `sortTeamCollections` method does not emit a PubSub event after reordering. Connected clients will not see the sort result in real-time unless they refresh.

2. **N+1 queries in isParent:** The cycle detection algorithm makes one database query per ancestor level. For deep trees, this could be slow. A recursive CTE would reduce this to one query but adds SQL complexity.

3. **No bulk delete optimization:** Deleting a collection deletes its children via database cascading constraints, but the sibling reindexing only handles the deleted collection's own sibling set. If multiple collections are deleted from the same parent, each delete triggers its own reindex + retry loop.

4. **Export is recursive with sequential queries:** `exportCollectionToJSONObject` makes one query per level per collection. For very wide/deep trees, this could be slow. A single recursive CTE could fetch the entire subtree more efficiently.

5. **No retry on move or reorder:** If a move or reorder operation encounters a deadlock (rare but possible), it fails without retry. Only delete has the retry loop.

6. **PubSub publish is fire-and-forget:** If the PubSub publish fails after a successful database commit, clients miss the update. There is no outbox pattern or retry mechanism for event delivery.

## Error Handling

All public methods return `E.Either<ErrorCode, Result>` using fp-ts. Business errors are returned as `E.left(ERROR_CODE)`, never thrown as exceptions.

**Error codes used:**

| Error Code | Meaning |
|------------|---------|
| `TEAM_COLL_SHORT_TITLE` | Title is shorter than TITLE_LENGTH (1 character) |
| `TEAM_COLL_DATA_INVALID` | Data field is empty string or invalid JSON |
| `TEAM_COLL_NOT_FOUND` | Collection ID does not exist |
| `TEAM_INVALID_COLL_ID` | Invalid collection ID (used in export/duplicate) |
| `TEAM_NOT_OWNER` | Parent collection does not belong to the specified team |
| `TEAM_COL_ALREADY_ROOT` | Attempting to move a root collection to root (no-op) |
| `TEAM_COLL_DEST_SAME` | Attempting to move a collection into itself |
| `TEAM_COLL_NOT_SAME_TEAM` | Cross-team move attempted |
| `TEAM_COLL_IS_PARENT_COLL` | Move would create a circular reference |
| `TEAM_COL_SAME_NEXT_COLL` | Reordering a collection next to itself |
| `TEAM_COL_REORDERING_FAILED` | Reorder/delete failed after retries exhausted |
| `TEAM_COLL_INVALID_JSON` | Import JSON is malformed |
| `TEAM_COLL_CREATION_FAILED` | Collection creation failed (transaction error) |
| `TEAM_COL_SEARCH_FAILED` | Collection search query failed |
| `TEAM_REQ_SEARCH_FAILED` | Request search query failed |
| `TEAM_COLL_PARENT_TREE_GEN_FAILED` | Parent tree CTE failed for a collection |
| `TEAM_REQ_PARENT_TREE_GEN_FAILED` | Parent tree CTE failed for a request |
| `TEAM_MEMBER_NOT_FOUND` | User is not a member of the team (CLI access) |

Database exceptions (Prisma errors) are caught within try/catch blocks and mapped to the appropriate business error codes. The only exception is the retry loop in `deleteCollectionAndUpdateSiblingsOrderIndex`, which specifically catches and retries transient database errors (deadlocks, unique constraint violations, transaction timeouts) while passing through all other errors as failures.
