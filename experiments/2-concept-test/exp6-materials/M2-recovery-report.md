# Drift Recovery Report: TeamCollectionService

## Summary

Source drift detected. The code has changed since the graph was last synced. This report identifies every difference between the stale graph (context package) and the current source code, provides BEFORE/AFTER for each artifact that needs updating, and checks for aspect violations.

---

## 1. Differences Identified

### 1.1 `updateCollectionOrder` Semantics Completely Changed

**This is the largest single drift.** The graph describes "nextCollectionID" semantics ("place me just before this collection"). The code now uses "targetCollectionID" semantics ("place me right after this collection"), plus the null case changed from "move to end" to "move to beginning."

| Aspect | Graph (Stale) | Code (Current) |
|---|---|---|
| Second parameter name | `nextCollectionID` | `targetCollectionID` |
| Null meaning | Move to **end** of list | Move to **beginning** of list |
| Non-null meaning | "Place me just **before** this collection" | "Place me right **after** this collection |
| Null algorithm | Decrement siblings > current; set orderIndex = count | Increment siblings < current; set orderIndex = 1 |
| Non-null: moving UP range | `[nextCollection.orderIndex, collection.orderIndex - 1]` increment | `[targetCollection.orderIndex + 1, collection.orderIndex - 1]` increment |
| Non-null: moving DOWN range | `[collection.orderIndex + 1, nextCollection.orderIndex - 1]` decrement | `[collection.orderIndex + 1, targetCollection.orderIndex]` decrement |
| Non-null: final position (UP) | `nextCollection.orderIndex` | `targetCollection.orderIndex + 1` |
| Non-null: final position (DOWN) | `nextCollection.orderIndex - 1` | `targetCollection.orderIndex` |
| PubSub payload key | `nextCollection` | `nextCollection` (unchanged key name, but semantically it is the target) |

### 1.2 `moveCollection` Now Runs Inside a Single Transaction with Locking

**Graph says:** `moveCollection` calls `isParent` and `changeParentAndUpdateOrderIndex` but does not describe a wrapping transaction or locking at the move-collection level.

**Code shows:** The entire `moveCollection` method is wrapped in `this.prisma.$transaction(async (tx) => { ... })`. Inside the transaction:
- It calls `getCollection(collectionID, tx)` passing the transaction client
- It acquires a pessimistic lock on the source collection's sibling set
- For dest != null, it acquires a SECOND lock on the destination collection's sibling set
- It calls `isParent(collection, destCollection, tx)` passing the transaction client
- It calls `changeParentAndUpdateOrderIndex(tx, collection, newParentID)` passing the transaction client
- On catch, returns `E.left(TEAM_COL_REORDERING_FAILED)`

This is a significant architectural change: `moveCollection` is now itself transactional with pessimistic locking, not just delegating to helper methods that each manage their own transactions.

### 1.3 `changeParentAndUpdateOrderIndex` Signature Changed

**Graph says:** Not explicitly documented at signature level, but the logic description implies it manages its own transaction.

**Code shows:** The method now accepts a `tx: Prisma.TransactionClient` as its first parameter. It no longer opens its own transaction; it operates within the caller's transaction. Signature: `private async changeParentAndUpdateOrderIndex(tx, collection, newParentID)`.

### 1.4 `isParent` Now Accepts Optional Transaction Client

**Graph says:** `isParent` is described as doing recursive walks but no mention of transaction awareness.

**Code shows:** Signature is `private async isParent(collection, destCollection, tx: Prisma.TransactionClient | null = null)`. It passes `tx` to `getCollection()` calls during its recursive walk, ensuring the ancestor check runs within the same transaction as the move operation. This prevents TOCTOU races.

### 1.5 `getCollection` Now Accepts Optional Transaction Client

**Graph says:** Not documented.

**Code shows:** `async getCollection(collectionID, tx: Prisma.TransactionClient | null = null)` -- uses `(tx || this.prisma).teamCollection.findUniqueOrThrow(...)`.

### 1.6 `getCollectionCount` Now Accepts Optional Transaction Client

**Graph says:** Not documented as a method at all.

**Code shows:** `getCollectionCount(collectionID, teamID, tx: Prisma.TransactionClient | null = null)` -- a public method that counts child collections.

### 1.7 `sortTeamCollections` Method -- New

**Graph says:** "Sort siblings" is mentioned in the parent hierarchy responsibility as a tree operation, but no logic or constraints are documented for sorting.

**Code shows:** A full `sortTeamCollections(teamID, parentID, sortBy: SortOptions)` method that:
1. Acquires pessimistic lock via `lockTeamCollectionByTeamAndParent`
2. Reads all siblings ordered by the requested sort option (TITLE_ASC, TITLE_DESC, or default orderIndex)
3. Reassigns contiguous orderIndex values (1, 2, 3...) based on the new sort order
4. Uses Promise.all for parallel updates within the transaction

### 1.8 `importCollectionsFromJSON` Now Uses Pessimistic Locking

**Graph says:** Not explicitly described regarding locking during import.

**Code shows:** Import now acquires a pessimistic lock (`lockTeamCollectionByTeamAndParent`) before reading the last orderIndex and creating collections. This is inside a `prisma.$transaction`. It also wraps the entire operation in a try/catch that returns `TEAM_COLL_CREATION_FAILED` on failure.

### 1.9 `createCollection` Now Uses Pessimistic Locking and Transaction

**Graph says:** Create is described as appending at `lastIndex + 1` but locking is not explicitly mentioned for create.

**Code shows:** Create now runs inside `prisma.$transaction` with `lockTeamCollectionByTeamAndParent`. On failure, returns `TEAM_COLL_CREATION_FAILED`.

### 1.10 New Error Code: `TEAM_COLL_CREATION_FAILED`

**Graph says:** Not mentioned.

**Code shows:** Imported from `../errors` and used in both `createCollection` and `importCollectionsFromJSON` as a catch-all for transaction failures.

### 1.11 New Dependency: `TeamService`

**Graph says:** `relations: []` (no relations declared).

**Code shows:** Constructor injects `TeamService` and uses it in `getCollectionForCLI` to call `this.teamService.getTeamMember(collection.teamID, userUid)`. This is a runtime dependency.

### 1.12 New Error Code: `TEAM_MEMBER_NOT_FOUND`

**Graph says:** Not mentioned.

**Code shows:** Used in `getCollectionForCLI` when the user is not a member of the team.

### 1.13 `totalCollectionsInTeam` Method -- Not in Graph

**Graph says:** Not mentioned.

**Code shows:** Public method that returns the count of all collections in a team (no parent filter).

### 1.14 `getTeamCollectionsCount` Method -- Not in Graph

**Graph says:** Not mentioned.

**Code shows:** Public method that returns count of ALL team collections in the entire database.

### 1.15 `SortOptions` Import

**Graph says:** Not mentioned.

**Code shows:** Imports `SortOptions` from `src/types/SortOptions`, used in `sortTeamCollections`.

---

## 2. Artifact Updates Required

### 2.1 node.yaml

**BEFORE:**
```yaml
name: TeamCollectionService
type: service
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]

relations: []

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-collection/team-collection.service.ts
```

**AFTER:**
```yaml
name: TeamCollectionService
type: service
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]

relations:
  - type: depends-on
    target: team/team-service
    reason: getCollectionForCLI verifies team membership via TeamService.getTeamMember

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-collection/team-collection.service.ts
```

### 2.2 responsibility.md

**BEFORE:**
```markdown
# TeamCollectionService -- Responsibility

The central service for all team collection operations. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

## In scope

- Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves
- Import/export: recursive JSON serialization and deserialization of entire collection subtrees
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access

## Out of scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)
```

**AFTER:**
```markdown
# TeamCollectionService -- Responsibility

The central service for all team collection operations. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

## In scope

- Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings by title
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves, runs within the move transaction to prevent TOCTOU races
- Import/export: recursive JSON serialization and deserialization of entire collection subtrees, with pessimistic locking during import
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` (with team membership verification via TeamService) and `getCollectionTreeForCLI` for command-line access
- Counting: `totalCollectionsInTeam` (per-team count), `getTeamCollectionsCount` (global count), `getCollectionCount` (children of a specific parent)
- Sorting: `sortTeamCollections` reassigns contiguous orderIndex values based on chosen sort option (title ascending, title descending, or current order)

## Out of scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections
- Team membership management (delegated to TeamService, but team membership is verified for CLI access)
- PubSub infrastructure (delegated to PubSubService)
```

### 2.3 logic.md

**BEFORE:**
```markdown
# TeamCollectionService -- Logic

## Reorder algorithm (updateCollectionOrder)

Two cases based on `nextCollectionID`:

### Move to end (nextCollectionID = null)

1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

### Move to specific position (nextCollectionID != null)

1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up -> `nextCollection.orderIndex`, if moving down -> `nextCollection.orderIndex - 1`

The "next collection" semantics mean: "place me just before this collection."

## isParent (circular reference check)

Recursive walk from destination UP to root:
1. If source === destination -> return None (invalid, means self-move)
2. If destination.parentID === source.id -> return None (source IS an ancestor)
3. If destination.parentID !== null -> recurse with destination = destination.parent
4. If destination.parentID === null -> reached root without finding source -> return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

## Move collection (changeParentAndUpdateOrderIndex)

1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents within a single transaction.
```

**AFTER:**
```markdown
# TeamCollectionService -- Logic

## Reorder algorithm (updateCollectionOrder)

Two cases based on `targetCollectionID`:

### Move to beginning (targetCollectionID = null)

1. Lock siblings via `lockTeamCollectionByTeamAndParent`
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Increment all siblings with orderIndex < current (shifts them down to open position 1)
4. Set collection's orderIndex = 1 (puts it at the beginning)

### Move to specific position (targetCollectionID != null)

1. Lock siblings via `lockTeamCollectionByTeamAndParent`
2. Re-read BOTH collection and targetCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = targetCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[targetCollection.orderIndex + 1, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, targetCollection.orderIndex]`
6. Set collection's orderIndex to: if moving up -> `targetCollection.orderIndex + 1`, if moving down -> `targetCollection.orderIndex`

The "target collection" semantics mean: "place me right after this collection." This is the inverse of the previous "next collection" semantics.

## isParent (circular reference check)

Recursive walk from destination UP to root. Now accepts an optional transaction client to run within the move transaction, preventing TOCTOU races.

1. If source === destination -> return None (invalid, means self-move)
2. If destination.parentID === source.id -> return None (source IS an ancestor)
3. If destination.parentID !== null -> recurse with destination = destination.parent (fetched via getCollection with tx)
4. If destination.parentID === null -> reached root without finding source -> return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

## Move collection (moveCollection + changeParentAndUpdateOrderIndex)

`moveCollection` now wraps the entire operation in a single `prisma.$transaction`:

1. Fetch collection inside transaction
2. Lock source collection's sibling set
3. If moving to root: check not already root, then call `changeParentAndUpdateOrderIndex(tx, collection, null)`
4. If moving to another collection:
   a. Validate not self-move
   b. Fetch destination collection inside transaction
   c. Validate same team
   d. Run `isParent` check inside the same transaction
   e. Lock destination collection's sibling set (second lock acquisition)
   f. Call `changeParentAndUpdateOrderIndex(tx, collection, destCollection.id)`

`changeParentAndUpdateOrderIndex(tx, collection, newParentID)` operates within the caller's transaction:

1. Find last orderIndex under new parent (using tx)
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents. The wrapping transaction in `moveCollection` ensures atomicity across both parent changes and the circular reference check.

## Sort algorithm (sortTeamCollections)

1. Lock siblings via `lockTeamCollectionByTeamAndParent`
2. Fetch all sibling collections ordered by the requested sort option (TITLE_ASC, TITLE_DESC, or default orderIndex)
3. Reassign orderIndex values as contiguous integers starting from 1, based on the sorted order
4. Uses `Promise.all` for parallel updates within the transaction

## Create collection (createCollection)

1. Validate title length
2. If parentID provided, verify ownership via `isOwnerCheck`
3. Validate data field (reject empty string, parse JSON)
4. Inside `prisma.$transaction`:
   a. Lock siblings via `lockTeamCollectionByTeamAndParent`
   b. Find last orderIndex under parent
   c. Create collection with orderIndex = last + 1 (or 1 if none exist)
5. Publish `coll_added` event
6. On transaction failure, return `TEAM_COLL_CREATION_FAILED`

## Import collections (importCollectionsFromJSON)

1. Parse and validate JSON input
2. Inside `prisma.$transaction`:
   a. Lock siblings via `lockTeamCollectionByTeamAndParent`
   b. Find last orderIndex under target parent
   c. Generate Prisma query objects with sequential orderIndex values
   d. Create all collections via `Promise.all`
3. Publish `coll_added` events for each created collection
4. On transaction failure, return `TEAM_COLL_CREATION_FAILED`
```

### 2.4 constraints.md

**BEFORE:**
```markdown
# TeamCollectionService -- Constraints

## Circular reference prevention

A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This prevents infinite loops in the tree structure.

## OrderIndex contiguity

Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1. This invariant ensures no gaps and no duplicates, which is critical for predictable cursor-based pagination and drag-and-drop UI.

## Same-team constraint

A collection can only be moved to a parent that belongs to the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`.

## Self-move prevention

A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered next to itself (`TEAM_COL_SAME_NEXT_COLL`).

## Already-root guard

Moving a root collection to root (parentID null -> null) is rejected with `TEAM_COL_ALREADY_ROOT`. This is a no-op prevention, not a business rule.

## Title minimum length

Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.

## Data field validation

The optional `data` field (collection metadata/headers) must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`.
```

**AFTER:**
```markdown
# TeamCollectionService -- Constraints

## Circular reference prevention

A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root within the same transaction as the move. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. Running inside the move transaction prevents TOCTOU races where the tree structure could change between the check and the move.

## OrderIndex contiguity

Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1. Sort reassigns all siblings to contiguous values. This invariant ensures no gaps and no duplicates, which is critical for predictable cursor-based pagination and drag-and-drop UI.

## Same-team constraint

A collection can only be moved to a parent that belongs to the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`. Reorder also validates same-team between collection and target.

## Self-move prevention

A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered to the same position as itself (`TEAM_COL_SAME_NEXT_COLL`).

## Already-root guard

Moving a root collection to root (parentID null -> null) is rejected with `TEAM_COL_ALREADY_ROOT`. This is a no-op prevention, not a business rule.

## Title minimum length

Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.

## Data field validation

The optional `data` field (collection metadata/headers) must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`.

## Team membership for CLI access

`getCollectionForCLI` verifies that the requesting user is a member of the collection's team via `TeamService.getTeamMember`. If not a member, returns `TEAM_MEMBER_NOT_FOUND`.
```

### 2.5 decisions.md

**BEFORE:**
```markdown
# TeamCollectionService -- Decisions

## Why duplication uses export + import
(unchanged)

## Why search uses raw SQL instead of Prisma query builder
(unchanged)

## Why parent tree reconstruction uses recursive CTE
(unchanged)

## Why `isParent` walks up, not down
(unchanged)

## Why orderIndex is integer-based, not fractional
(unchanged)

## Why delete has retries but other mutations do not
(unchanged -- but see note below about accuracy)
```

**AFTER:** Add one new decision:
```markdown
## Why moveCollection wraps everything in a single transaction

The move operation involves multiple steps: checking circular references (isParent), locking source siblings, locking destination siblings, decrementing source sibling indexes, and appending to destination. Previously these could race with concurrent operations. Wrapping in a single transaction with pessimistic locks on both the source and destination sibling sets ensures atomicity. The isParent check also runs within this transaction so the tree structure cannot change between the check and the move (TOCTOU prevention).
```

**Note on existing decision accuracy:** The decision "Why delete has retries but other mutations do not" remains accurate. Create and import now have their own transactions with pessimistic locking but still do not retry -- they return `TEAM_COLL_CREATION_FAILED` on any transaction error. Only delete uses the retry loop.

---

## 3. Aspect Violation Check

### 3.1 Pessimistic Locking Aspect

**Status: COMPLIANT (improved)**

The aspect requires: "Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first."

| Operation | Graph Described Locking? | Code Has Locking? | Status |
|---|---|---|---|
| createCollection | No | YES (new) | Improved |
| deleteCollectionAndUpdateSiblingsOrderIndex | Yes | Yes | Compliant |
| updateCollectionOrder (null case) | Yes | Yes | Compliant |
| updateCollectionOrder (non-null case) | Yes | Yes | Compliant |
| moveCollection | No | YES (new, locks both source and dest) | Improved |
| importCollectionsFromJSON | No | YES (new) | Improved |
| sortTeamCollections | N/A (not in graph) | Yes | New, Compliant |

The code is now MORE compliant with the pessimistic locking aspect than the graph described. `createCollection`, `importCollectionsFromJSON`, and `moveCollection` all now acquire locks, which the previous graph did not capture.

### 3.2 PubSub Events Aspect

**Status: COMPLIANT**

All mutations still publish events after transaction completion. The channel naming and payload shapes are unchanged:
- `coll_added` -- create and import
- `coll_updated` -- rename and updateTeamCollection
- `coll_removed` -- delete (payload: collection ID)
- `coll_moved` -- moveCollection
- `coll_order_updated` -- updateCollectionOrder

**Note:** `sortTeamCollections` does NOT publish any PubSub event. This could be a **potential violation** of the aspect which states "Every mutation to a team collection publishes a PubSub event." Sorting modifies orderIndex values (a mutation) but publishes no event. Connected clients will not receive real-time updates when a sort occurs.

### 3.3 Retry on Deadlock Aspect

**Status: COMPLIANT**

The retry loop is still only on `deleteCollectionAndUpdateSiblingsOrderIndex`. The aspect correctly states "Currently only deleteCollectionAndUpdateSiblingsOrderIndex." The new operations (create, import, sort, move) handle errors by returning Left values but do not retry. This is consistent with the aspect's stated rationale.

---

## 4. Potential Aspect Violation: sortTeamCollections Missing PubSub Event

**Severity: Medium**

`sortTeamCollections` mutates orderIndex values for all siblings under a parent but does not publish any PubSub event. The PubSub Events aspect states: "Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates."

This means:
- A user sorts collections on the backend
- Other connected clients viewing the same team do not receive a notification
- Their UI remains in the old order until they refresh

**Recommendation:** Either add a PubSub event for sort (possibly a new channel like `coll_order_updated` with a batch payload, or individual `coll_order_updated` events per collection), or explicitly document this as an intentional exception in the aspect.

---

## 5. Potential Bug: `fetchCollectionParentTree` Missing Return

At line 1277 of the source code:

```typescript
} catch (error) {
  E.left(TEAM_COLL_PARENT_TREE_GEN_FAILED);  // missing 'return'!
}
```

The `fetchCollectionParentTree` method does not `return` the `E.left(...)` in its catch block (unlike `fetchRequestParentTree` which correctly has `return E.left(...)`). This means on error, the method returns `undefined`, which will cause a runtime error when the caller tries to check `E.isLeft(fetchedParentTree)`.

This is not a graph drift issue but is worth noting as a latent bug discovered during the analysis.

---

## 6. Summary of All Required Graph Changes

| Artifact | Change Type | Description |
|---|---|---|
| `node.yaml` | Update | Add `depends-on` relation to `team/team-service` |
| `responsibility.md` | Update | Add counting methods, sorting, CLI team membership check, import locking, transactional isParent |
| `logic.md` | Rewrite | Completely rewrite reorder algorithm (target semantics, move-to-beginning); document transactional moveCollection; add sort algorithm; add create/import transaction logic |
| `constraints.md` | Update | Add transactional isParent note, sort mention, CLI team membership constraint |
| `decisions.md` | Update | Add decision for why moveCollection uses single transaction |
| Pessimistic Locking aspect | No change needed | Aspect is correct; code is now more compliant than before |
| PubSub Events aspect | Potential update | Either document sortTeamCollections as exception or flag as violation to fix |
| Retry on Deadlock aspect | No change needed | Still accurately describes current behavior |
