# Consistency Review: C2 (TeamCollectionService)

## Graph artifacts reviewed

- `aspects/pessimistic-locking/` (aspect.yaml + content.md)
- `aspects/pubsub-events/` (aspect.yaml + content.md)
- `aspects/retry-on-deadlock/` (aspect.yaml + content.md)
- `flows/collection-management/` (flow.yaml + description.md)
- `model/team-collections/` (node.yaml + responsibility.md)
- `model/team-collections/team-collection-service/` (node.yaml + responsibility.md + constraints.md + decisions.md + logic.md)

## Source file reviewed

`packages/hoppscotch-backend/src/team-collection/team-collection.service.ts` (1550 lines)

---

### Inconsistencies Found (wrong claims)

| # | Graph artifact | Claim | Code evidence | Severity |
|---|---|---|---|---|
| 1 | `aspects/retry-on-deadlock/aspect.yaml` | Description says "Exponential retry for specific database transaction errors" | The actual backoff strategy is **linear** (`retryCount * 100ms`), as correctly described in the same aspect's `content.md` section "Why linear, not exponential." The YAML description contradicts its own content file. | Medium |
| 2 | `aspects/retry-on-deadlock/content.md` | "Maximum retries: 5 (`MAX_RETRIES`)" and "On exhaustion: returns `E.left(TEAM_COL_REORDERING_FAILED)`" | The code at lines 600-607 increments `retryCount` first, then checks `retryCount >= this.MAX_RETRIES`. This means the first failure (retryCount=1) is checked against MAX_RETRIES=5, so the loop runs the transaction up to 5 times (1 initial + 4 retries, not 1 initial + 5 retries). If all 5 fail, the `while` loop exits and falls through to `return E.right(true)` at line 614. So on true exhaustion with retryable errors, it returns **`E.right(true)` (success)**, not `E.left(TEAM_COL_REORDERING_FAILED)`. The left return only happens for non-retryable errors or when MAX_RETRIES is reached with non-retryable error in the same iteration. | High |
| 3 | `aspects/pubsub-events/content.md` | "Every mutation to a team collection publishes a PubSub event so that connected clients receive real-time updates." | The `sortTeamCollections` method (lines 1502-1549) is a mutation that reorders all sibling collections by title, but it publishes **no PubSub event** at all. This violates the stated invariant. | High |
| 4 | `flows/collection-management/description.md` | Move collection step 3: "Lock destination's sibling set (if moving into a collection)" | The code at lines 810-814 locks `lockTeamCollectionByTeamAndParent(tx, destCollection.right.teamID, destCollection.right.parentID)` -- this locks the **siblings of the destination collection** (collections sharing the same parent as destCollection), NOT the children under the destination (which will be the moved collection's new siblings). The graph's phrasing "destination's sibling set" technically matches the code, but it is misleading because the lock does not protect the sibling set that the moved collection is joining. | Medium |
| 5 | `logic.md` (isParent) | "If source === destination -> return None (invalid, means self-move)" | Code at line 716 uses `collection === destCollection` which is **JavaScript object reference equality**, not value/ID equality. Since `collection` and `destCollection` are separate objects fetched independently from the database, this comparison will never be true even if both have the same ID. This check is effectively dead code. The actual self-move protection is at line 785 (`collectionID === destCollectionID`) comparing string IDs before `isParent` is ever called. | Medium |
| 6 | `flows/collection-management/description.md` | Invariant: "All business errors return fp-ts Either.left, never throw" | The `moveCollection` method at lines 747-836 wraps the entire transaction in a try/catch and returns `E.left(TEAM_COL_REORDERING_FAILED)` for any exception. However, **inside** the transaction, individual operations like `getCollection` return Either.left for expected errors (e.g., not found), but the inner `ConflictException` thrown at line 503 and similar locations in `createCollection` means exceptions DO propagate from inner transactions. More importantly, `getTeamOfCollection` (line 307) accesses `teamCollection.team` without null checking -- if the collection exists but team relation fails, this throws rather than returning Either.left. | Low |
| 7 | `flows/collection-management/description.md` | Search step 2: "reconstruct the parent tree using recursive CTE (WITH RECURSIVE)" | The code uses recursive CTEs for parent tree reconstruction (lines 1257-1270, 1347-1359), which is correct. However, the graph says "For each result: reconstruct the parent tree using recursive CTE" implying one CTE per result. The code in `searchByTitle` (lines 1140-1156) indeed calls `fetchParentTree` in a **loop** for each search result, making N separate CTE queries -- not a single efficient CTE for all results. The graph's description obscures this N+1 query pattern. | Low |

### Omissions Found (missing from graph)

| # | Code pattern | Where in code | Why it matters |
|---|---|---|---|
| 1 | **`sortTeamCollections` method** -- no flow path described | Lines 1502-1549 | The sort operation is mentioned in responsibility lists ("sort") but has no dedicated flow path in `collection-management/description.md`. It is a significant mutation: it re-assigns orderIndex values for an entire sibling set based on title sorting. It also lacks a PubSub event, which should be documented as a known gap or intentional omission. |
| 2 | **`renameCollection` is deprecated** | Line 520: `@deprecated Use updateTeamCollection method instead` | The graph mentions "rename" in the responsibility but does not note that `renameCollection` is deprecated in favor of `updateTeamCollection`. Understanding which API is current vs deprecated matters for anyone modifying this code. |
| 3 | **Authorization check inside service for CLI** | Lines 1444-1448: `getCollectionForCLI` checks `teamService.getTeamMember` | The graph's "Out of scope" section states "Authentication/authorization (handled by resolvers and guards)" but the service itself performs authorization for CLI access by checking team membership. This contradicts the stated boundary. |
| 4 | **`transformCollectionData` utility for data field** | Lines 147, 280 (cast method and export) | The `data` field goes through a `transformCollectionData` utility function before being used. This transformation step is not documented anywhere in the graph, yet it could affect data shape. |
| 5 | **`ConflictException` wrapping pattern** | Lines 252, 503, 591, 921, 1005 | Inside every `prisma.$transaction`, errors are caught and re-thrown as NestJS `ConflictException`. This is a consistent pattern that affects error handling behavior (the outer catch receives a NestJS exception, not the original Prisma error). This is relevant because the retry logic checks `error.code` which may not be present on a `ConflictException` wrapper. |
| 6 | **`totalCollectionsInTeam` and `getTeamCollectionsCount` methods** | Lines 1028-1046 | These are read-only utility methods for counting collections (per-team and global). They are not mentioned in any graph artifact, yet they are part of the service's public API. |
| 7 | **`getParentOfCollection` and `getChildrenOfCollection` methods** | Lines 319-363 | These navigation methods are part of the service's public API (used by resolvers for GraphQL field resolution) but are not mentioned in the graph. |
| 8 | **`getTeamOfCollection` method** | Lines 296-311 | Public method to resolve the team that owns a collection. Not mentioned in the graph. |
| 9 | **Cursor-based pagination** | Lines 341-356, 373-396 | `getChildrenOfCollection` and `getTeamRootCollections` implement cursor-based pagination with `take`, `skip`, and `cursor` parameters. This pagination pattern is not documented in the graph. |
| 10 | **Move-to-root has no lock on root-level siblings** | Lines 759-781 in `moveCollection` | When moving a collection to root (`destCollectionID = null`), the code only locks the source's current siblings but does NOT lock the root-level siblings that will be modified by `changeParentAndUpdateOrderIndex`. This is a potential concurrency issue not mentioned in the graph. |
| 11 | **`fetchCollectionParentTree` has a missing return for error case** | Line 1278: `E.left(TEAM_COLL_PARENT_TREE_GEN_FAILED)` without `return` | The catch block does `E.left(...)` but does NOT return it. The function returns `undefined` on error instead of `E.left(...)`. This is a bug not captured in the graph. |
| 12 | **`isOwnerCheck` private method** | Lines 429-442 | A private method that verifies a collection belongs to a specific team. Used in `createCollection` to validate parent ownership. Not mentioned in graph artifacts. |
| 13 | **`generatePrismaQueryObjForFBCollFolder` recursive builder** | Lines 70-102 | This private method recursively builds Prisma `CreateInput` objects for import. It handles nested children and requests with auto-incrementing orderIndex. The graph mentions the import flow but not the recursive query object builder pattern. |
| 14 | **Dependency on TeamService** | Line 56: `private readonly teamService: TeamService` | The service depends on `TeamService` for team member verification, but `relations: []` is declared in both node.yaml files. This dependency is semantically relevant. |

### Consistent Claims (summary)

The following graph claims were verified as accurate against the source code:

- **Pessimistic locking pattern**: The `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` call is consistently used before sibling-order mutations in create, delete, import, move, reorder, and sort operations.
- **PubSub channel naming**: All five channel patterns (`coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated`) match the code exactly with the `team_coll/${teamID}/` prefix.
- **PubSub payload shapes**: Added/Updated/Moved publish the cast TeamCollection model; Removed publishes just the ID string; Order updated publishes `{ collection, nextCollection }`.
- **Retry error codes**: The code checks `PrismaError.UNIQUE_CONSTRAINT_VIOLATION`, `PrismaError.TRANSACTION_DEADLOCK`, and `PrismaError.TRANSACTION_TIMEOUT` exactly as documented.
- **Linear backoff formula**: `delay(retryCount * 100)` producing 100ms, 200ms, 300ms, 400ms delays.
- **MAX_RETRIES = 5**: `this.MAX_RETRIES = 5` at line 60.
- **TITLE_LENGTH = 1**: `this.TITLE_LENGTH = 1` at line 59.
- **Circular reference prevention**: `isParent` walks up from destination to root, checking parent chain.
- **Same-team constraint**: Verified in `moveCollection` (line 795) and `updateCollectionOrder` (line 945-946).
- **Self-move prevention**: `TEAM_COLL_DEST_SAME` at line 787, `TEAM_COL_SAME_NEXT_COLL` at line 868.
- **Already-root guard**: `TEAM_COL_ALREADY_ROOT` at line 763.
- **Data field validation**: Empty string rejection and JSON parse validation in both `createCollection` and `updateTeamCollection`.
- **Duplication via export+import**: `duplicateTeamCollection` exports to JSON, appends " - Duplicate" to title, then re-imports.
- **Search uses raw SQL with ILIKE and similarity()**: Both `searchCollections` and `searchRequests` use `Prisma.sql` with `ILIKE` and `similarity()`.
- **Recursive CTE for parent tree**: Both `fetchCollectionParentTree` and `fetchRequestParentTree` use `WITH RECURSIVE`.
- **OrderIndex is 1-based**: Create uses `lastCollection.orderIndex + 1` or `1` if first. Sort assigns `i + 1`.
- **Create collection flow**: Validates title, checks parent ownership, locks, finds last orderIndex, creates with `last + 1`, publishes event. All match code.
- **Delete collection flow**: Fetches collection, delegates to `deleteCollectionAndUpdateSiblingsOrderIndex` with `{ gt: orderIndex }` and `{ decrement: 1 }`, publishes `coll_removed`.
- **Reorder algorithm (move to position)**: Direction detection, range calculation, increment/decrement logic, final orderIndex assignment all match the graph's logic.md description exactly.
- **Move collection `changeParentAndUpdateOrderIndex`**: Finds last orderIndex under new parent, decrements original siblings, updates parentID and orderIndex. Correct.
- **Decision rationale accuracy**: All five decisions (duplication via export+import, raw SQL for search, recursive CTE for breadcrumbs, isParent walks up not down, integer-based orderIndex) accurately describe the code patterns and trade-offs.
- **Retry only on `deleteCollectionAndUpdateSiblingsOrderIndex`**: Only this method has the retry loop; other mutations rely solely on pessimistic locking.

### Overall Assessment

The graph is **substantially accurate** in its description of the core business logic, algorithms, and architectural patterns. The reorder algorithm, move logic, import/export flows, and constraint validations are described with high fidelity to the code. The decision rationale documents are particularly well-crafted and genuinely explain the "why" behind implementation choices.

However, there are **several meaningful issues**:

1. **One high-severity inconsistency**: The retry exhaustion behavior is misdescribed. The code falls through to `E.right(true)` on full exhaustion with retryable errors, not `E.left(TEAM_COL_REORDERING_FAILED)` as stated. This could lead an implementer to incorrectly assume the failure case is handled.

2. **One high-severity omission**: `sortTeamCollections` is a mutation that violates the graph's own "every mutation publishes a PubSub event" invariant but is not called out.

3. **Internal inconsistency**: The retry-on-deadlock aspect.yaml says "Exponential" while the content.md says "linear." This is confusing.

4. **Missing public API surface**: Multiple public methods (`getTeamOfCollection`, `getParentOfCollection`, `getChildrenOfCollection`, `totalCollectionsInTeam`, `getTeamCollectionsCount`) are not mentioned. These are part of the service's contract used by resolvers and would need to be understood by anyone modifying the service.

5. **Missing concurrency gap**: The move-to-root path does not lock root-level siblings, creating a potential race condition that the graph does not highlight.

6. **A real code bug is missed**: `fetchCollectionParentTree` has a missing `return` on the error path (line 1278), causing it to return `undefined` instead of `E.left(...)`.

The graph covers approximately 75-80% of the service's behavioral surface accurately. The core mutation paths and their invariants are well-documented. The gaps are primarily in read-only utility methods and edge cases in error handling.
