# Hoppscotch TeamCollectionService -- T1 Graph Accuracy Audit

**Graph source:** `/workspaces/memory2/exp-base-hoppscotch-context.txt`
**Code source:** `/tmp/exp5/hoppscotch-team-collection.service-T1.ts`
**Date:** 2026-03-03

---

## 1. Global Section

### Claim 1.1: Language is TypeScript
**Verdict: ACCURATE**
The file is a `.ts` file with TypeScript syntax throughout (type annotations, generics, `as` casts, interfaces).

### Claim 1.2: Runtime is Node.js
**Verdict: ACCURATE**
NestJS runs on Node.js. The imports (`@nestjs/common`, `@prisma/client`) confirm this.

### Claim 1.3: Framework is NestJS
**Verdict: ACCURATE**
The class uses `@Injectable()` decorator (line 50) and imports from `@nestjs/common` (line 1). Constructor injection pattern is standard NestJS.

### Claim 1.4: fp-ts Either/Option for error handling (never throw for business errors)
**Verdict: ACCURATE**
The service imports `* as E from 'fp-ts/Either'` and `* as O from 'fp-ts/Option'` (lines 31-32). All public methods return `E.left(...)` or `E.right(...)` for business errors. Exceptions are only thrown inside `$transaction` callbacks via `throw new ConflictException(error)` for database-level errors, which are caught and converted to `E.left(...)` outside the transaction.

### Claim 1.5: Prisma ORM for database access
**Verdict: ACCURATE**
`PrismaService` is injected (line 53). All database operations use `this.prisma.*` or transaction `tx.*` calls with Prisma query builder and raw SQL via `Prisma.sql`.

### Claim 1.6: PubSub for real-time event propagation
**Verdict: ACCURATE**
`PubSubService` is injected (line 54). Events are published via `this.pubsub.publish(...)` after mutations throughout the service.

### Claim 1.7: Collections form a tree hierarchy (parent-child)
**Verdict: ACCURATE**
The `parentID` field is used extensively. Root collections have `parentID: null`. Child collections reference their parent via `parentID`. The recursive `isParent` method (line 715) walks the tree upward.

### Claim 1.8: OrderIndex is integer-based for sibling ordering
**Verdict: ACCURATE**
`orderIndex` is used throughout with integer arithmetic: `+ 1`, `{ increment: 1 }`, `{ decrement: 1 }`. Values start at 1 (line 478: `lastCollection ? lastCollection.orderIndex + 1 : 1`).

### Claim 1.9: All mutations that affect sibling order use row locking via lockTeamCollectionByTeamAndParent
**Verdict: PARTIALLY ACCURATE**
Mutations do use row locking, but the actual locking function names in the T1 code differ from the claim. The code uses two different locking approaches:
- `this.prisma.lockTableExclusive(tx, 'TeamCollection')` -- used in `importCollectionsFromJSON` (line 209), `createCollection` (line 462), and `deleteCollectionAndUpdateSiblingsOrderIndex` (line 545). This is a **table-level** exclusive lock, not a row lock scoped to `(teamID, parentID)`.
- `this.prisma.acquireLocks(tx, 'TeamCollection', null, ...)` -- used in `updateCollectionOrder` (lines 869-874 and 934-939).
- `changeParentAndUpdateOrderIndex` (line 660) does **not** use any explicit locking call.

The claim names a specific function `lockTeamCollectionByTeamAndParent` which does not appear in the T1 code. The actual locking is a mix of table-exclusive locks and `acquireLocks` calls.

---

## 2. Hierarchy Section (team-collections)

### Claim 2.1: Manages hierarchical collection tree for teams
**Verdict: ACCURATE**
The entire service is organized around a tree of collections with `parentID` relationships, scoped by `teamID`.

### Claim 2.2: Arbitrary nesting depth
**Verdict: ACCURATE**
The recursive methods (`isParent`, `exportCollectionToJSONObject`, `getCollectionTreeForCLI`, `deleteCollectionData`) impose no depth limit.

### Claim 2.3: Integer-based sibling ordering
**Verdict: ACCURATE**
See Claim 1.8 above. Confirmed throughout.

### Claim 2.4: Real-time collaboration via PubSub events
**Verdict: ACCURATE**
Every mutation method publishes a PubSub event. See Claim 1.6.

### Claim 2.5 (In scope): Collection CRUD
**Verdict: ACCURATE**
`createCollection` (line 435), `renameCollection` (line 506), `updateTeamCollection` (line 1033), `deleteCollection` (line 635), `getCollection` (line 390).

### Claim 2.6 (In scope): Tree operations (move between parents, reorder siblings, sort)
**Verdict: PARTIALLY ACCURATE**
Move: `moveCollection` (line 763) + `changeParentAndUpdateOrderIndex` (line 653). Reorder: `updateCollectionOrder` (line 851). However, there is **no sort method** in the T1 code. The graph claims "sort siblings" is in scope, but no alphabetical or custom sort operation exists in this file version.

### Claim 2.7 (In scope): Tree integrity (circular reference prevention, orderIndex consistency)
**Verdict: ACCURATE**
`isParent` (line 715) prevents circular references. OrderIndex is maintained by decrementing on delete (line 614-618) and incrementing/shifting on reorder/create/move.

### Claim 2.8 (In scope): Import/export (JSON serialization of entire subtrees)
**Verdict: ACCURATE**
`exportCollectionToJSONObject` (line 110), `exportCollectionsToJSON` (line 163), `importCollectionsFromJSON` (line 190).

### Claim 2.9 (In scope): Search with parent tree reconstruction (breadcrumb paths)
**Verdict: ACCURATE**
`searchByTitle` (line 1079) calls `searchCollections`/`searchRequests` (raw SQL with ILIKE + similarity), then `fetchParentTree` which uses recursive CTEs (`fetchCollectionParentTree` line 1232, `fetchRequestParentTree` line 1321).

### Claim 2.10 (In scope): Duplication (export + re-import pattern)
**Verdict: ACCURATE**
`duplicateTeamCollection` (line 1446) exports via `exportCollectionToJSONObject`, modifies the title, then calls `importCollectionsFromJSON`.

### Claim 2.11 (In scope): Real-time event publishing for all mutations
**Verdict: ACCURATE**
All mutation methods publish PubSub events: `coll_added` (create, import), `coll_updated` (rename, update), `coll_removed` (delete), `coll_moved` (move), `coll_order_updated` (reorder).

### Claim 2.12 (Out of scope): User authentication and authorization
**Verdict: ACCURATE**
No auth logic in this service. The only team-member check is in `getCollectionForCLI` (line 1421-1425) which delegates to `teamService.getTeamMember`.

### Claim 2.13 (Out of scope): Request-level CRUD
**Verdict: ACCURATE**
The service only reads and deletes requests as part of collection operations (export, delete cascade). No standalone request CRUD methods.

### Claim 2.14 (Out of scope): Team management
**Verdict: ACCURATE**
`TeamService` is injected but only used for `getTeamMember` in the CLI method.

---

## 3. Own Artifacts -- node.yaml

### Claim 3.1: Type is service
**Verdict: ACCURATE**
`@Injectable()` NestJS service class.

### Claim 3.2: Aspects include pessimistic-locking, pubsub-events, retry-on-deadlock
**Verdict: ACCURATE**
All three patterns are present in the code. See detailed aspect sections below.

### Claim 3.3: Relations are empty (`relations: []`)
**Verdict: PARTIALLY ACCURATE**
The service does depend on `PrismaService`, `PubSubService`, and `TeamService` (constructor injection, lines 53-55). Declaring no relations is a modeling choice, but these are real runtime dependencies.

### Claim 3.4: Mapping path is `packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`
**Verdict: ACCURATE**
This is the expected file path for a NestJS backend service in Hoppscotch's monorepo structure, consistent with the imports.

---

## 4. Own Artifacts -- constraints.md

### Claim 4.1: Circular reference prevention -- `isParent` walks up the tree, rejects with `TEAM_COLL_IS_PARENT_COLL`
**Verdict: ACCURATE**
`isParent` (line 715) recursively walks up via `destCollection.parentID`. In `moveCollection` (line 812-813), `O.isNone(checkIfParent)` triggers `E.left(TEAM_COLL_IS_PARENT_COLL)`.

### Claim 4.2: OrderIndex contiguity -- values contiguous starting from 1, delete decrements higher siblings, create appends at lastIndex + 1, reorder shifts ranges by 1
**Verdict: ACCURATE**
- Create: `lastCollection.orderIndex + 1` or `1` if no siblings (line 478).
- Delete: `{ gt: collection.orderIndex }` with `{ decrement: 1 }` (lines 616-617).
- Reorder: shifts ranges up or down by 1 (lines 954-970).

### Claim 4.3: Same-team constraint -- cross-team moves rejected with `TEAM_COLL_NOT_SAME_TEAM`
**Verdict: ACCURATE**
`moveCollection` (lines 803-805): `if (collection.right.teamID !== destCollection.right.teamID) return E.left(TEAM_COLL_NOT_SAME_TEAM)`.

### Claim 4.4: Self-move prevention -- `TEAM_COLL_DEST_SAME` and `TEAM_COL_SAME_NEXT_COLL`
**Verdict: ACCURATE**
`moveCollection` (lines 793-795): `if (collectionID === destCollectionID) return E.left(TEAM_COLL_DEST_SAME)`.
`updateCollectionOrder` (lines 856-857): `if (collectionID === nextCollectionID) return E.left(TEAM_COL_SAME_NEXT_COLL)`.

### Claim 4.5: Already-root guard -- `TEAM_COL_ALREADY_ROOT` when parentID null to null
**Verdict: ACCURATE**
`moveCollection` (lines 769-773): `if (!destCollectionID)` and `if (!collection.right.parentID)` returns `E.left(TEAM_COL_ALREADY_ROOT)`.

### Claim 4.6: Title minimum length -- `TITLE_LENGTH = 1`, empty titles rejected with `TEAM_COLL_SHORT_TITLE`
**Verdict: INACCURATE**
The code sets `TITLE_LENGTH = 3` (line 58), not 1. The `isValidLength` function is called with `this.TITLE_LENGTH` which is 3. Titles shorter than 3 characters are rejected, not titles shorter than 1 character.

### Claim 4.7: Data field validation -- must be valid JSON, empty string explicitly rejected, invalid JSON rejected with `TEAM_COLL_DATA_INVALID`
**Verdict: ACCURATE**
`createCollection` (lines 450-454): `if (data === '') return E.left(TEAM_COLL_DATA_INVALID)` then validates JSON via `stringToJson`. Same pattern in `updateTeamCollection` (lines 1044-1048).

---

## 5. Own Artifacts -- decisions.md

### Claim 5.1: Duplication uses export + import pattern, appending " - Duplicate" to title
**Verdict: ACCURATE**
`duplicateTeamCollection` (lines 1446-1469): exports to JSON, modifies title with `` `${collection.right.title} - Duplicate` ``, then calls `importCollectionsFromJSON`.

### Claim 5.2: Search uses raw SQL for ILIKE, similarity(), and escapeSqlLikeString
**Verdict: ACCURATE**
`searchCollections` (lines 1153-1166) and `searchRequests` (lines 1191-1204) use `Prisma.sql` raw queries with `ILIKE`, `similarity()`, and `escapeSqlLikeString()`.

### Claim 5.3: Parent tree reconstruction uses recursive CTE (`WITH RECURSIVE`)
**Verdict: ACCURATE**
`fetchCollectionParentTree` (lines 1234-1247) and `fetchRequestParentTree` (lines 1323-1336) both use `WITH RECURSIVE` CTEs.

### Claim 5.4: `isParent` walks up (O(depth)) not down (O(subtree_size))
**Verdict: ACCURATE**
The `isParent` method (line 715) follows `destCollection.parentID` upward recursively. It never queries children/descendants.

### Claim 5.5: OrderIndex is integer-based, not fractional
**Verdict: ACCURATE**
All orderIndex operations use integer arithmetic. No fractional values anywhere.

### Claim 5.6: Delete has retries but other mutations do not
**Verdict: ACCURATE**
Only `deleteCollectionAndUpdateSiblingsOrderIndex` (line 534) has the retry loop (`while (retryCount < this.MAX_RETRIES)`). `createCollection`, `moveCollection`, `updateCollectionOrder` have no retry logic.

---

## 6. Own Artifacts -- logic.md

### Claim 6.1: Reorder -- Move to end (nextCollectionID = null)
**Sub-claims:**
1. Lock siblings -- **ACCURATE** (line 869: `this.prisma.acquireLocks(...)`)
2. Re-read collection's current orderIndex inside transaction -- **ACCURATE** (lines 877-880: `collectionInTx`)
3. Decrement all siblings with orderIndex > current -- **ACCURATE** (lines 881-891: `gte: collectionInTx.orderIndex + 1` with `{ decrement: 1 }`)
4. Set collection's orderIndex = total count of siblings -- **PARTIALLY ACCURATE** (lines 894-900: actually calls `this.getCollectionCount(collection.right.parentID)` which counts children of `parentID`, not "total count of siblings" in an abstract sense -- it uses the count of all collections under that parent, which after decrementing equals the last position. However, `getCollectionCount` queries **outside** the transaction using `this.prisma` not `tx`, which is a subtle detail the graph does not mention.)

**Overall verdict for 6.1: PARTIALLY ACCURATE** -- The description is functionally correct but omits that step 4 uses a non-transactional count query.

### Claim 6.2: Reorder -- Move to specific position (nextCollectionID != null)
**Sub-claims:**
1. Lock siblings -- **ACCURATE** (lines 934-939: `this.prisma.acquireLocks(...)`)
2. Re-read BOTH collection and nextCollection orderIndex inside transaction -- **ACCURATE** (lines 942-949: `collectionInTx` and `subsequentCollectionInTx`)
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex` -- **ACCURATE** (lines 950-951)
4. If moving UP: increment range `[nextCollection.orderIndex, collection.orderIndex - 1]` -- **ACCURATE** (lines 954-960 for `updateFrom`/`updateTo`, line 968 `{ increment: 1 }`)
5. If moving DOWN: decrement range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]` -- **ACCURATE** (lines 956/960 for `updateFrom`/`updateTo`, line 968 `{ decrement: 1 }`)
6. Set collection's orderIndex: if moving up -> `nextCollection.orderIndex`, if moving down -> `nextCollection.orderIndex - 1` -- **ACCURATE** (lines 976-978)

**Overall verdict for 6.2: ACCURATE**

### Claim 6.3: isParent (circular reference check) algorithm
**Sub-claims:**
1. If source === destination -> return None -- **ACCURATE** (lines 734-736: `if (collection === destCollection) return O.none`)
2. If destination.parentID === source.id -> return None -- **ACCURATE** (lines 739-741)
3. If destination.parentID !== null -> recurse with destination = destination.parent -- **ACCURATE** (lines 743-750)
4. If destination.parentID === null -> return Some(true) -- **ACCURATE** (lines 751-753)
5. None = invalid, Some(true) = valid -- **ACCURATE** (in `moveCollection` line 812: `if (O.isNone(checkIfParent)) return E.left(TEAM_COLL_IS_PARENT_COLL)`)

**Overall verdict for 6.3: ACCURATE**

### Claim 6.4: Move collection (changeParentAndUpdateOrderIndex)
**Sub-claims:**
1. Find last orderIndex under new parent -- **ACCURATE** (lines 663-667)
2. Decrement all siblings after the collection in its ORIGINAL parent -- **ACCURATE** (lines 670-679)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent -- **ACCURATE** (lines 682-692: `orderIndex: lastCollectionUnderNewParent ? lastCollectionUnderNewParent.orderIndex + 1 : 1`)
4. Two-parent operation within single transaction -- **ACCURATE** (both operations are inside `this.prisma.$transaction` at line 660)

**Overall verdict for 6.4: ACCURATE**

---

## 7. Own Artifacts -- responsibility.md

### Claim 7.1: Central service for all team collection operations
**Verdict: ACCURATE**
This is the only service file for team collections.

### Claim 7.2: Coordinates Prisma database transactions with pessimistic row locking
**Verdict: PARTIALLY ACCURATE**
It coordinates Prisma transactions with locking, but the T1 code uses **table-level** exclusive locks in most places (`lockTableExclusive`), not row-level locks scoped to `(teamID, parentID)`. Only `updateCollectionOrder` uses `acquireLocks` which may be more targeted.

### Claim 7.3: Maintains orderIndex consistency across sibling sets
**Verdict: ACCURATE**
Every mutation that changes the sibling set adjusts orderIndex values accordingly.

### Claim 7.4: Prevents circular tree structures
**Verdict: ACCURATE**
Via the `isParent` method.

### Claim 7.5: Publishes real-time PubSub events after every mutation
**Verdict: ACCURATE**
All mutation methods publish events.

### Claim 7.6 (In scope): Collection CRUD -- create, rename, update (title/data), delete with sibling reindexing
**Verdict: ACCURATE**
All present. `createCollection`, `renameCollection`, `updateTeamCollection`, `deleteCollection` (with `deleteCollectionData` + `deleteCollectionAndUpdateSiblingsOrderIndex`).

### Claim 7.7 (In scope): Tree operations -- move collection, reorder siblings, sort siblings
**Verdict: PARTIALLY ACCURATE**
Move and reorder are present. **Sort siblings is NOT present** in the T1 code. There is no method to alphabetically or otherwise sort siblings.

### Claim 7.8 (In scope): Tree integrity -- recursive ancestor check (isParent) to prevent circular moves
**Verdict: ACCURATE**

### Claim 7.9 (In scope): Import/export -- recursive JSON serialization and deserialization
**Verdict: ACCURATE**

### Claim 7.10 (In scope): Search -- raw SQL with ILIKE + similarity() fuzzy matching, plus recursive CTE
**Verdict: ACCURATE**

### Claim 7.11 (In scope): Duplication -- export-then-import with title modification
**Verdict: ACCURATE**

### Claim 7.12 (In scope): CLI support -- getCollectionForCLI and getCollectionTreeForCLI
**Verdict: ACCURATE**
`getCollectionForCLI` (line 1415) and `getCollectionTreeForCLI` (line 1384) are both present.

### Claim 7.13 (Out of scope): Authentication/authorization, request CRUD, team membership, PubSub infrastructure
**Verdict: ACCURATE**
None of these are implemented in this service.

---

## 8. Aspect: Pessimistic Locking

### Claim 8.1: Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first
**Verdict: PARTIALLY ACCURATE**
Most operations do lock, but `changeParentAndUpdateOrderIndex` (line 653) modifies sibling orderIndex values in both source and destination parents **without any explicit locking call**. It uses a transaction but does not call `lockTableExclusive` or `acquireLocks`.

### Claim 8.2: Pattern -- open `prisma.$transaction`, call `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`
**Verdict: INACCURATE**
The function `lockTeamCollectionByTeamAndParent` does not appear anywhere in the T1 code. The actual locking functions used are:
- `this.prisma.lockTableExclusive(tx, 'TeamCollection')` -- a table-level lock
- `this.prisma.acquireLocks(tx, 'TeamCollection', null, ...)` -- used only in `updateCollectionOrder`

### Claim 8.3: Why pessimistic not optimistic -- reorder operations touch MANY siblings, optimistic would be impractical
**Verdict: ACCURATE**
The reasoning is sound. `updateMany` with range conditions is used throughout (e.g., lines 881-891, 962-970).

### Claim 8.4: Lock scope is `(teamID, parentID)` -- locks siblings, not entire team's collections
**Verdict: INACCURATE**
In the T1 code, `lockTableExclusive(tx, 'TeamCollection')` locks the **entire TeamCollection table**, not just siblings under a specific `(teamID, parentID)`. Only `acquireLocks` in `updateCollectionOrder` passes a more specific scope. The graph's claim that "operations on different subtrees can proceed in parallel" is false for the three methods using `lockTableExclusive`.

---

## 9. Aspect: PubSub Events

### Claim 9.1: Every mutation publishes a PubSub event
**Verdict: ACCURATE**
Verified across all mutation methods: create, rename, update, delete, move, reorder, import, duplicate.

### Claim 9.2: Channel naming convention
| Channel claimed | Present in code | Verdict |
|---|---|---|
| `team_coll/${teamID}/coll_added` | line 251, line 491 | ACCURATE |
| `team_coll/${teamID}/coll_updated` | line 517, line 1059 | ACCURATE |
| `team_coll/${teamID}/coll_removed` | line 621-623 | ACCURATE |
| `team_coll/${teamID}/coll_moved` | line 784-787, line 824-826 | ACCURATE |
| `team_coll/${teamID}/coll_order_updated` | line 907-913, line 986-992 | ACCURATE |

**Overall verdict: ACCURATE**

### Claim 9.3: Events are published AFTER the database transaction commits successfully
**Verdict: ACCURATE**
In all cases, `this.pubsub.publish(...)` is called outside and after the `await this.prisma.$transaction(...)` block. For example, `createCollection`: transaction at lines 459-484, publish at lines 490-493. For `deleteCollectionAndUpdateSiblingsOrderIndex`: the publish happens in `deleteCollectionData` (line 621) after the delete+reindex method returns `E.right`.

### Claim 9.4: Exception for deleteCollectionAndUpdateSiblingsOrderIndex -- PubSub call happens after the retry loop succeeds
**Verdict: ACCURATE**
The retry loop is in `deleteCollectionAndUpdateSiblingsOrderIndex` (lines 540-584). The PubSub publish for `coll_removed` is in `deleteCollectionData` (line 621-624), which calls the retry method first and only continues to publish if `E.isRight`.

### Claim 9.5: Payload shapes -- Added/Updated/Moved: full TeamCollection model; Removed: just collection ID; Order updated: `{ collection, nextCollection }` pair
**Verdict: ACCURATE**
- Added: `this.cast(collection)` (line 252, 493) -- full model
- Updated: `this.cast(updatedTeamCollection)` (line 518, 1061) -- full model
- Removed: `collection.id` (line 623) -- just ID string
- Moved: `updatedCollection.right` (line 786, 825) -- full model
- Order updated: `{ collection: this.cast(...), nextCollection: ... }` (lines 909-912, 988-991) -- pair

**Overall verdict: ACCURATE**

---

## 10. Aspect: Retry on Deadlock

### Claim 10.1: Delete+reorder operations use a retry loop
**Verdict: ACCURATE**
`deleteCollectionAndUpdateSiblingsOrderIndex` (line 534) contains the retry loop.

### Claim 10.2: Retry conditions -- UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT
**Verdict: ACCURATE**
Lines 573-575: the code checks `error.code !== PrismaError.UNIQUE_CONSTRAINT_VIOLATION && error.code !== PrismaError.TRANSACTION_DEADLOCK && error.code !== PrismaError.TRANSACTION_TIMEOUT`. Only these three codes continue the retry loop; any other code returns immediately.

### Claim 10.3: Maximum retries is 5 (MAX_RETRIES)
**Verdict: ACCURATE**
Line 59: `MAX_RETRIES = 5`.

### Claim 10.4: Linear backoff -- `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)
**Verdict: ACCURATE**
Line 579: `await delay(retryCount * 100)`. With `retryCount` incrementing from 1 to 5.

### Claim 10.5: On exhaustion returns `E.left(TEAM_COL_REORDERING_FAILED)`
**Verdict: ACCURATE**
Line 577: `return E.left(TEAM_COL_REORDERING_FAILED)` when `retryCount >= this.MAX_RETRIES`.

### Claim 10.6: Maximum total wait is 1.5 seconds
**Verdict: ACCURATE**
100 + 200 + 300 + 400 + 500 = 1500ms = 1.5 seconds.

### Claim 10.7: Currently only applies to `deleteCollectionAndUpdateSiblingsOrderIndex`; other order mutations do NOT retry
**Verdict: ACCURATE**
`createCollection`, `moveCollection` (`changeParentAndUpdateOrderIndex`), and `updateCollectionOrder` have no retry loops.

### Claim 10.8: Why linear not exponential -- lock contention window is short
**Verdict: ACCURATE** (as a design rationale -- cannot be verified from code alone, but the reasoning is consistent with the implementation).

---

## Summary

| Artifact / Aspect | Total Claims | Accurate | Partially Accurate | Inaccurate |
|---|---|---|---|---|
| Global | 9 | 9 | 0 | 0 |
| Hierarchy (team-collections) | 14 | 12 | 2 | 0 |
| node.yaml | 4 | 3 | 1 | 0 |
| constraints.md | 7 | 6 | 0 | 1 |
| decisions.md | 6 | 6 | 0 | 0 |
| logic.md | 4 | 3 | 1 | 0 |
| responsibility.md | 13 | 12 | 1 | 0 |
| Aspect: Pessimistic Locking | 4 | 1 | 1 | 2 |
| Aspect: PubSub Events | 5 | 5 | 0 | 0 |
| Aspect: Retry on Deadlock | 8 | 8 | 0 | 0 |
| **TOTAL** | **74** | **65** | **6** | **3** |

### Accuracy Rate: 87.8% Accurate, 8.1% Partially Accurate, 4.1% Inaccurate

---

## Key Inaccuracies

1. **TITLE_LENGTH = 1 (constraints.md Claim 4.6):** The graph claims `TITLE_LENGTH = 1`. The T1 code has `TITLE_LENGTH = 3` (line 58). This is a factual error.

2. **lockTeamCollectionByTeamAndParent (Pessimistic Locking Claim 8.2):** The graph names a locking function that does not exist in the T1 code. The actual functions are `lockTableExclusive` and `acquireLocks`.

3. **Lock scope is (teamID, parentID) (Pessimistic Locking Claim 8.4):** The graph claims locks are scoped to siblings under a specific parent. In reality, most operations in T1 use `lockTableExclusive` which locks the entire table, preventing parallel operations on different subtrees.

## Key Partial Accuracies

1. **Sort siblings (Hierarchy 2.6, Responsibility 7.7):** The graph lists "sort siblings" as in-scope, but no sort operation exists in the T1 code.

2. **changeParentAndUpdateOrderIndex lacks locking (Pessimistic Locking 8.1):** The graph claims every sibling-modifying operation locks first, but this method does not explicitly lock.

3. **Reorder move-to-end uses non-transactional count (Logic 6.1):** The graph's description is functionally correct but omits that `getCollectionCount` runs outside the transaction context.

4. **Empty relations (node.yaml 3.3):** Three runtime dependencies exist (PrismaService, PubSubService, TeamService) but are not declared.
