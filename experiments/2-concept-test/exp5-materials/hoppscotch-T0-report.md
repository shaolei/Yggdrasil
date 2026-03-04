# Hoppscotch TeamCollectionService -- T0 Graph Accuracy Audit

**Context package:** `/workspaces/memory2/exp-base-hoppscotch-context.txt`
**Historical code:** `/tmp/exp5/hoppscotch-team-collection.service-T0.ts`

---

## 1. Global Section

### Claim 1.1: Language is TypeScript, runtime is Node.js, framework is NestJS
**ACCURATE.** The file imports from `@nestjs/common` (`Injectable`, `HttpStatus`) and uses NestJS patterns (constructor injection, `@Injectable()` decorator). TypeScript throughout.

### Claim 1.2: fp-ts Either/Option for error handling (never throw for business errors)
**ACCURATE.** The code uses `E.left(...)` / `E.right(...)` and `O.some(...)` / `O.none` pervasively for business error returns. No `throw` statements for business logic errors; `throw` only occurs indirectly via Prisma's `findUniqueOrThrow`/`findFirstOrThrow` which are caught in try/catch blocks and converted to Either values.

### Claim 1.3: Prisma ORM for database access
**ACCURATE.** All database operations go through `this.prisma` (a `PrismaService`), using Prisma query methods (`findMany`, `create`, `update`, `updateMany`, `delete`, `count`, `$queryRaw`, `$transaction`).

### Claim 1.4: PubSub for real-time event propagation
**ACCURATE.** `PubSubService` is injected and used throughout (`this.pubsub.publish(...)`) after every mutation.

### Claim 1.5: Collections form a tree hierarchy (parent-child)
**ACCURATE.** Collections have `parentID` field, with `null` meaning root. Recursive traversal code (e.g., `isParent`, `exportCollectionToJSONObject`, `getCollectionTreeForCLI`) confirms arbitrary nesting.

### Claim 1.6: OrderIndex is integer-based for sibling ordering
**ACCURATE.** OrderIndex is used as an integer throughout (`orderIndex: 'asc'`, `{ increment: 1 }`, `{ decrement: 1 }`). Integer arithmetic is used for all orderIndex operations.

### Claim 1.7: All mutations that affect sibling order use row locking via `lockTeamCollectionByTeamAndParent`
**INACCURATE.** There is **zero** locking in the T0 code. A search for `lock` or `Lock` returns no matches. The `updateCollectionOrder` method uses `prisma.$transaction` but with no explicit row locking calls. The `createCollection`, `deleteCollection`, and `moveCollection` methods do not even use transactions. The function `lockTeamCollectionByTeamAndParent` does not exist in this version of the code.

---

## 2. Hierarchy Artifact (team-collections/responsibility.md)

### Claim 2.1: Manages hierarchical collection tree for teams
**ACCURATE.** The entire service is dedicated to CRUD and tree operations on `TeamCollection` entities scoped by `teamID`.

### Claim 2.2: Integer-based sibling ordering
**ACCURATE.** See Claim 1.6 above.

### Claim 2.3: Real-time collaboration via PubSub events
**ACCURATE.** PubSub events published after every mutation.

### Claim 2.4: Collection CRUD (create, read, update, delete) in scope
**ACCURATE.** Methods: `createCollection`, `getCollection`, `renameCollection`, `updateTeamCollection`, `deleteCollection`.

### Claim 2.5: Tree operations (move between parents, reorder siblings, sort) in scope
**PARTIALLY ACCURATE.** Move (`moveCollection`) and reorder (`updateCollectionOrder`) exist. However, there is **no sort method** in the T0 code. No method named `sort` or `sortTeamCollection` or similar exists.

### Claim 2.6: Tree integrity (circular reference prevention, orderIndex consistency) in scope
**ACCURATE.** `isParent` method performs circular reference prevention. OrderIndex updates occur on delete and reorder.

### Claim 2.7: Import/export (JSON serialization of entire subtrees) in scope
**ACCURATE.** `exportCollectionToJSONObject`, `exportCollectionsToJSON`, `importCollectionsFromJSON`, `replaceCollectionsWithJSON`.

### Claim 2.8: Search with parent tree reconstruction (breadcrumb paths) in scope
**ACCURATE.** `searchByTitle` uses raw SQL with `ILIKE` + `similarity()`, and `fetchCollectionParentTree` / `fetchRequestParentTree` use recursive CTEs.

### Claim 2.9: Duplication (export + re-import pattern) in scope
**ACCURATE.** `duplicateTeamCollection` exports then re-imports with modified title.

### Claim 2.10: Real-time event publishing for all mutations in scope
**ACCURATE.** Every mutation method publishes a PubSub event.

### Claim 2.11: User authentication/authorization out of scope
**ACCURATE.** No auth logic in service; only `isOwnerCheck` verifies collection-team ownership, not user identity (except `getCollectionForCLI` which checks team membership via `TeamService`).

### Claim 2.12: Request-level CRUD out of scope
**ACCURATE.** No request CRUD methods; only reads requests for export/search purposes.

### Claim 2.13: Team management delegated to TeamService
**ACCURATE.** `TeamService` is injected and used only for `getTeamMember` check.

---

## 3. Own Artifacts

### 3.1 node.yaml

#### Claim 3.1.1: Node type is "service"
**ACCURATE.** The class is `@Injectable()` and named `TeamCollectionService`, acting as a NestJS service.

#### Claim 3.1.2: Aspects include pessimistic-locking
**INACCURATE.** No pessimistic locking exists in T0 code. See Claim 1.7.

#### Claim 3.1.3: Aspects include pubsub-events
**ACCURATE.** PubSub events are published throughout.

#### Claim 3.1.4: Aspects include retry-on-deadlock
**INACCURATE.** No retry logic exists in T0 code. No retry loops, no `MAX_RETRIES`, no deadlock handling. See Section 6 below.

#### Claim 3.1.5: Mapping path is `packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`
**ACCURATE.** This is the expected file path (cannot fully verify without the repo structure, but consistent with NestJS conventions and the import paths).

---

### 3.2 constraints.md

#### Claim 3.2.1: Circular reference prevention -- `isParent` walks up from destination to root, rejects with `TEAM_COLL_IS_PARENT_COLL`
**ACCURATE.** Lines 762-801: `isParent` recursively walks up via `destCollection.parentID`, returning `O.none` if source is found as ancestor. `moveCollection` maps `O.isNone(checkIfParent)` to `E.left(TEAM_COLL_IS_PARENT_COLL)`.

#### Claim 3.2.2: OrderIndex contiguity -- values contiguous starting from 1, every delete decrements higher siblings, every create appends at `lastIndex + 1`
**PARTIALLY ACCURATE.** Delete does decrement higher siblings (line 710-714). Create does append at count + 1 (lines 563-565). However, the graph says "contiguous starting from 1" but the code's `getChildCollectionsCount`/`getRootCollectionsCount` returns the highest orderIndex (not count), and `generatePrismaQueryObjForFBCollFolder` starts at `orderIndex: orderIndex` (passed as `count + 1`). Import uses `index + 1` for children (line 92), so new imports start from 1. The contiguity claim is the intent but is imperfectly enforced (e.g., the `changeParent` method has a bug at line 735 where `collectionCount` is always overwritten regardless of the `if` condition).

#### Claim 3.2.3: Same-team constraint -- cross-team moves rejected with `TEAM_COLL_NOT_SAME_TEAM`
**ACCURATE.** Line 852-853 in `moveCollection` and line 965-966 in `updateCollectionOrder`.

#### Claim 3.2.4: Self-move prevention -- `TEAM_COLL_DEST_SAME` and `TEAM_COL_SAME_NEXT_COLL`
**ACCURATE.** Line 842-844 (`TEAM_COLL_DEST_SAME` in `moveCollection`) and line 911-912 (`TEAM_COL_SAME_NEXT_COLL` in `updateCollectionOrder`).

#### Claim 3.2.5: Already-root guard -- `TEAM_COL_ALREADY_ROOT` when moving root to root
**ACCURATE.** Lines 817-820: if `destCollectionID` is null and collection is already root, returns `E.left(TEAM_COL_ALREADY_ROOT)`.

#### Claim 3.2.6: Title minimum length is 1 (`TITLE_LENGTH = 1`)
**INACCURATE.** Line 55: `TITLE_LENGTH = 3`, not 1. The minimum title length is 3 characters, not 1.

#### Claim 3.2.7: Data field validation -- must be valid JSON, empty string rejected, invalid JSON rejected with `TEAM_COLL_DATA_INVALID`
**ACCURATE.** Lines 538-543 in `createCollection` and 1060-1064 in `updateTeamCollection`: empty string check returns `TEAM_COLL_DATA_INVALID`, then `stringToJson` validates JSON.

---

### 3.3 decisions.md

#### Claim 3.3.1: Duplication uses export + import -- exports to JSON, modifies title (appending " - Duplicate"), re-imports
**ACCURATE.** Lines 1464-1487: `duplicateTeamCollection` calls `exportCollectionToJSONObject`, then `importCollectionsFromJSON` with `name: \`${collection.right.title} - Duplicate\``.

#### Claim 3.3.2: Search uses raw SQL because of ILIKE, similarity(), escapeSqlLikeString
**ACCURATE.** Lines 1169-1189 (`searchCollections`) and 1207-1228 (`searchRequests`) use `Prisma.sql` with `ILIKE`, `similarity()`, and `escapeSqlLikeString`.

#### Claim 3.3.3: Parent tree reconstruction uses recursive CTE
**ACCURATE.** Lines 1250-1264 (`fetchCollectionParentTree`) and 1340-1354 (`fetchRequestParentTree`) use `WITH RECURSIVE` CTEs.

#### Claim 3.3.4: `isParent` walks up, not down -- O(depth) not O(subtree_size)
**ACCURATE.** Lines 762-801: recursive walk up via `destCollection.parentID` chain, not traversal of descendants.

#### Claim 3.3.5: OrderIndex is integer-based, not fractional -- requires touching multiple rows but guarantees contiguity
**ACCURATE.** See Claims 1.6 and 3.2.2. The code uses `{ increment: 1 }` / `{ decrement: 1 }` on ranges of siblings.

#### Claim 3.3.6: Delete has retries but other mutations do not -- retry loop handles transient deadlocks
**INACCURATE.** There are **no retries anywhere** in T0 code. The `deleteCollection` method has no retry logic, no transaction wrapping the delete+reindex, and no deadlock handling. There is no method named `deleteCollectionAndUpdateSiblingsOrderIndex`. This feature does not exist in the T0 codebase.

---

### 3.4 logic.md

#### Claim 3.4.1: Reorder algorithm -- move to end (nextCollectionID = null)
The graph claims:
1. Lock siblings
2. Re-read collection's current orderIndex inside transaction
3. Decrement all siblings with orderIndex > current
4. Set collection's orderIndex = total count of siblings

**PARTIALLY ACCURATE.** Steps 3 and 4 are accurate (lines 922-942). However:
- Step 1 is **INACCURATE**: There is no locking. No `lockTeamCollectionByTeamAndParent` call.
- Step 2 is **INACCURATE**: The code does NOT re-read the collection inside the transaction. It uses the pre-transaction value `collection.right.orderIndex` (read at line 915, outside the transaction). The `getCollectionCount` call at line 938-939 reads the count but uses `this.getCollectionCount` which queries outside `tx` scope (it calls `this.prisma.teamCollection.count`, not `tx.teamCollection.count`).

#### Claim 3.4.2: Reorder algorithm -- move to specific position (nextCollectionID != null)
The graph claims:
1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction via `isMovingUp`
4-6. Shift ranges and update orderIndex.

**PARTIALLY ACCURATE.** Steps 3-6 are accurate (lines 970-999). However:
- Step 1 is **INACCURATE**: No locking exists.
- Step 2 is **INACCURATE**: The code does NOT re-read either collection inside the transaction. It uses pre-fetched values from outside the transaction (`collection.right.orderIndex` and `subsequentCollection.right.orderIndex`).

#### Claim 3.4.3: "Next collection" semantics mean "place me just before this collection"
**ACCURATE.** The reorder logic moves the collection to `nextCollection.orderIndex` (when moving up) or `nextCollection.orderIndex - 1` (when moving down), effectively placing it just before the next collection.

#### Claim 3.4.4: `isParent` -- recursive walk from destination up to root
The graph claims:
1. source === destination -> return None
2. destination.parentID === source.id -> return None
3. destination.parentID !== null -> recurse
4. destination.parentID === null -> return Some(true)

**ACCURATE.** Lines 780-800 match this logic exactly. The code checks `collection === destCollection` (returns `O.none`), then `destCollection.parentID === collection.id` (returns `O.none`), then recurses or returns `O.some(true)` at root.

#### Claim 3.4.5: Move collection (`changeParentAndUpdateOrderIndex`) -- three steps: find last orderIndex, decrement old siblings, update collection
**PARTIALLY ACCURATE.** The logic described is roughly correct but:
- The method name is **INACCURATE**: the actual method is called `changeParent` (line 726), not `changeParentAndUpdateOrderIndex`. The decrementing of old siblings actually happens in `moveCollection` (lines 823-827, 866-870) before calling `changeParent`, not inside `changeParent` itself.
- The `changeParent` method only handles step 1 (find last orderIndex) and step 3 (update collection parentID + orderIndex). Step 2 (decrement old siblings) is done by the caller (`moveCollection`).
- The graph says "within a single transaction" but `moveCollection` does NOT use a transaction. The updateOrderIndex call and the changeParent call are separate, non-transactional operations.

---

### 3.5 responsibility.md (own-artifact level)

#### Claim 3.5.1: Coordinates Prisma database transactions with pessimistic row locking
**INACCURATE.** There is no pessimistic row locking. Transactions exist only in `updateCollectionOrder` and `importCollectionsFromJSON`/`replaceCollectionsWithJSON`. Most mutations (`createCollection`, `deleteCollection`, `moveCollection`) run without transactions.

#### Claim 3.5.2: Maintains orderIndex consistency across sibling sets
**PARTIALLY ACCURATE.** OrderIndex updates occur on delete and reorder, but without transactions or locking in most operations, consistency is only maintained under non-concurrent conditions.

#### Claim 3.5.3: Prevents circular tree structures
**ACCURATE.** `isParent` method prevents circular moves.

#### Claim 3.5.4: Publishes real-time PubSub events after every mutation
**ACCURATE.** Every mutation publishes PubSub events.

#### Claim 3.5.5: Collection CRUD in scope
**ACCURATE.** All CRUD operations present.

#### Claim 3.5.6: Tree operations -- move, reorder siblings, sort siblings
**PARTIALLY ACCURATE.** Move and reorder exist. **Sort does not exist** in T0 code.

#### Claim 3.5.7: Import/export with recursive JSON serialization/deserialization
**ACCURATE.** `exportCollectionToJSONObject` and `importCollectionsFromJSON` handle recursive structures.

#### Claim 3.5.8: Search with raw SQL, ILIKE + similarity(), recursive CTE for parent tree
**ACCURATE.** See Claims 3.3.2 and 3.3.3.

#### Claim 3.5.9: Duplication via export-then-import with title modification
**ACCURATE.** See Claim 3.3.1.

#### Claim 3.5.10: CLI support -- `getCollectionForCLI` and `getCollectionTreeForCLI`
**ACCURATE.** Both methods exist (lines 1433, 1402).

#### Claim 3.5.11: Authentication/authorization out of scope
**ACCURATE.** No auth logic in service beyond ownership and team membership checks.

#### Claim 3.5.12: Individual request CRUD out of scope
**ACCURATE.** No request CRUD operations.

#### Claim 3.5.13: Team membership management delegated to TeamService
**ACCURATE.** `TeamService` used only for `getTeamMember`.

#### Claim 3.5.14: PubSub infrastructure delegated to PubSubService
**ACCURATE.** Service only calls `this.pubsub.publish(...)`, never manages PubSub infrastructure.

---

## 4. Aspect: Pessimistic Locking

### Claim 4.1: Every operation that modifies sibling orderIndex acquires a row lock first
**INACCURATE.** No row locking exists in T0 code. Zero calls to any locking function. No `lockTeamCollectionByTeamAndParent` function.

### Claim 4.2: Pattern -- open `prisma.$transaction`, call `lockTeamCollectionByTeamAndParent`, read state, mutate, commit
**INACCURATE.** This pattern does not exist in T0 code. While `$transaction` is used in `updateCollectionOrder`, there is no lock acquisition step. Most mutation methods don't even use transactions.

### Claim 4.3: Pessimistic chosen over optimistic because reorder touches many siblings
**INACCURATE.** This rationale may be valid as a design consideration, but the implementation does not use pessimistic locking at all, so the claim is describing a feature that does not exist in this code version.

### Claim 4.4: Lock scoped to (teamID, parentID) -- locks siblings, not entire team
**INACCURATE.** No locking mechanism exists to scope.

---

## 5. Aspect: PubSub Events

### Claim 5.1: Every mutation publishes a PubSub event
**ACCURATE.** Verified across all mutation methods: `createCollection` (line 569), `renameCollection` (line 599), `updateTeamCollection` (line 1075), `deleteCollectionData` (line 687), `moveCollection` (lines 833, 879), `updateCollectionOrder` (lines 945, 1002), `importCollectionsFromJSON` (line 228), `replaceCollectionsWithJSON` (line 301), `duplicateTeamCollection` (via import).

### Claim 5.2: Channel naming convention -- `team_coll/${teamID}/coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated`
**ACCURATE.** All five channel names verified in code:
- `coll_added`: lines 230, 303, 570
- `coll_updated`: lines 600, 1076
- `coll_removed`: line 688
- `coll_moved`: lines 834, 880
- `coll_order_updated`: lines 946, 1003

### Claim 5.3: Events published AFTER database transaction commits
**PARTIALLY ACCURATE.** For `updateCollectionOrder`, the PubSub call is outside the `$transaction` block (lines 945-951, 1002-1008), so yes, it's after commit. For `importCollectionsFromJSON`/`replaceCollectionsWithJSON`, PubSub is after the `$transaction` call. However, for `createCollection`, `renameCollection`, `updateTeamCollection`, `deleteCollectionData`, and `moveCollection`, there are no transactions at all -- the PubSub call simply follows the database write. The claim about `deleteCollectionAndUpdateSiblingsOrderIndex` and retry loops is **INACCURATE** as that method does not exist.

### Claim 5.4: Payload shape -- Added/Updated/Moved: full TeamCollection model (cast from DB record)
**ACCURATE.** These events pass `this.cast(teamCollection)` which produces a `TeamCollection` model object.

### Claim 5.5: Payload shape -- Removed: just the collection ID string
**ACCURATE.** Line 689: `deletedTeamCollection.right.id` (string ID only).

### Claim 5.6: Payload shape -- Order updated: `{ collection, nextCollection }` pair
**ACCURATE.** Lines 947-950 and 1004-1007: `{ collection: this.cast(...), nextCollection: ... }`.

---

## 6. Aspect: Retry on Deadlock

### Claim 6.1: Delete+reorder operations use a retry loop
**INACCURATE.** No retry loop exists anywhere in T0 code. `deleteCollection` is a simple sequential call to `deleteCollectionData` followed by `updateOrderIndex`, with no retry logic.

### Claim 6.2: Retry conditions -- UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT
**INACCURATE.** None of these error codes are referenced in the T0 code.

### Claim 6.3: Strategy -- MAX_RETRIES=5, linear backoff (retryCount * 100ms), returns TEAM_COL_REORDERING_FAILED on exhaustion
**INACCURATE.** No `MAX_RETRIES` constant, no backoff logic, no retry count. `TEAM_COL_REORDERING_FAILED` IS imported (line 15) but is only used in `updateCollectionOrder`'s catch blocks (lines 955, 1012), not in any retry-exhaustion path.

### Claim 6.4: Linear backoff rationale (short contention window, max 1.5s wait)
**INACCURATE.** No backoff of any kind exists.

### Claim 6.5: Only applies to `deleteCollectionAndUpdateSiblingsOrderIndex`
**INACCURATE.** This method does not exist in T0 code. The delete operation is split between `deleteCollection` and `deleteCollectionData`, neither of which has retry logic.

---

## Summary

| Section | Total Claims | Accurate | Partially Accurate | Inaccurate |
|---|---|---|---|---|
| Global | 7 | 6 | 0 | 1 |
| Hierarchy (responsibility) | 13 | 11 | 1 | 1 |
| node.yaml | 5 | 3 | 0 | 2 |
| constraints.md | 7 | 5 | 1 | 1 |
| decisions.md | 6 | 5 | 0 | 1 |
| logic.md | 5 | 2 | 2 | 1 |
| responsibility.md (own) | 14 | 11 | 2 | 1 |
| Aspect: Pessimistic Locking | 4 | 0 | 0 | 4 |
| Aspect: PubSub Events | 6 | 5 | 1 | 0 |
| Aspect: Retry on Deadlock | 5 | 0 | 0 | 5 |
| **TOTAL** | **72** | **48** | **7** | **17** |

### Key Findings

1. **Pessimistic locking is entirely fabricated for T0.** The entire aspect (4 claims) describes a feature that does not exist in the historical code. There are no row locks, no `lockTeamCollectionByTeamAndParent` function, and most mutations do not even use database transactions.

2. **Retry-on-deadlock is entirely fabricated for T0.** The entire aspect (5 claims) describes a feature that does not exist. There are no retry loops, no deadlock handling, no backoff strategy, and no `deleteCollectionAndUpdateSiblingsOrderIndex` method.

3. **TITLE_LENGTH is 3, not 1.** The graph claims the minimum title length is 1 character, but the code sets `TITLE_LENGTH = 3`.

4. **Sort operation does not exist.** The graph mentions "sort siblings" as an in-scope operation, but no sort method exists in T0.

5. **The reorder algorithm description inaccurately claims locking and re-reads** inside transactions that do not exist. The core shift logic is correct, but the safety mechanisms described are absent.

6. **Move collection is not transactional.** The graph implies a single-transaction two-parent operation, but the code executes `updateOrderIndex` and `changeParent` as separate, non-transactional calls.

### Interpretation

The graph appears to describe a **later version** of the code that added pessimistic locking, retry-on-deadlock logic, and a `deleteCollectionAndUpdateSiblingsOrderIndex` method. These are features that were likely introduced after T0 to address concurrency issues. The T0 code has the core business logic (CRUD, tree operations, search, import/export, duplication, PubSub events) but lacks the concurrency safety mechanisms that the graph describes as present.
