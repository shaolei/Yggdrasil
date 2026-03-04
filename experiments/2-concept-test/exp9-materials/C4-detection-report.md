# C4 Detection Report: TeamCollectionService Graph vs Source Code

## Source File
`/workspaces/hoppscotch/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`

## Summary

After a line-by-line comparison of all graph artifacts against the source code, the following inconsistencies were found.

---

## Inconsistency 1: Retry-on-deadlock aspect incorrectly claims delete does NOT use retries

**Graph claim (retry-on-deadlock/content.md, "Where this applies" section):**
> "The delete operation does NOT use retries because delete is idempotent..."

**Also in decisions.md:**
> "Delete does not need retries because it is inherently idempotent..."

**Source code reality:**
The `deleteCollectionAndUpdateSiblingsOrderIndex` method (lines 555-615) **does** use a retry loop. It contains `while (retryCount < this.MAX_RETRIES)` with the same retry conditions (UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT) and the same linear backoff (`retryCount * 100`). The delete operation retries on exactly the same error codes as other operations.

**Verdict:** This is an **inversion error**. The graph states the opposite of what the code does. Delete operations DO have retries in the source code.

---

## Inconsistency 2: Retry-on-deadlock aspect claims "exponential" backoff in the title but describes linear

**Graph claim (retry-on-deadlock/aspect.yaml):**
> `description: Exponential retry for specific database transaction errors`

**Graph claim (retry-on-deadlock/content.md):**
> "Delay: linear backoff `retryCount * 100ms`"
> "Why linear, not exponential" section explains why linear is used.

**Source code (line 609):**
```typescript
await delay(retryCount * 100);
```

**Verdict:** The aspect.yaml description says "Exponential retry" but the content.md correctly describes linear backoff, and the source code confirms linear backoff (`retryCount * 100`). The **aspect.yaml description contradicts both its own content file and the source code**.

---

## Inconsistency 3: Create operation lacks retry loop (graph claims it has one)

**Graph claim (retry-on-deadlock/content.md, "Where this applies"):**
> "Retries apply to create, move, and reorder operations — all mutations that modify sibling orderIndex ranges."

**Graph claim (flows/collection-management/description.md, "Create collection" path):**
> "6. If deadlock/conflict: retry up to 5 times with linear backoff"

**Source code (`createCollection`, lines 452-517):**
The `createCollection` method does NOT have a retry loop. It wraps the Prisma transaction in a single try/catch and returns `E.left(TEAM_COLL_CREATION_FAILED)` on any error. There is no `while` loop, no `retryCount`, and no error-code checking for transient failures.

**Verdict:** The graph incorrectly attributes retry behavior to the create operation. In the source code, only `deleteCollectionAndUpdateSiblingsOrderIndex` has a retry loop. `moveCollection` and `updateCollectionOrder` also lack explicit retry loops (they just catch errors and return left).

---

## Inconsistency 4: Move operation lacks retry loop (graph claims it has one)

**Graph claim (flows/collection-management/description.md, "Move collection" path):**
> "7. If deadlock/conflict: retry up to 5 times with linear backoff"

**Graph claim (retry-on-deadlock/content.md):**
> "Retries apply to create, move, and reorder operations"

**Source code (`moveCollection`, lines 746-836):**
The `moveCollection` method uses a single `this.prisma.$transaction` wrapped in a try/catch. On error, it returns `E.left(TEAM_COL_REORDERING_FAILED)` with no retry loop.

**Verdict:** The graph incorrectly attributes retry behavior to the move operation. No retry loop exists in `moveCollection`.

---

## Inconsistency 5: Reorder operation lacks retry loop (graph claims it has one)

**Graph claim (flows/collection-management/description.md, "Reorder collection" path):**
> "8. If deadlock/conflict: retry up to 5 times with linear backoff"

**Source code (`updateCollectionOrder`, lines 862-1021):**
Both sub-paths (move to end and move to specific position) use `this.prisma.$transaction` wrapped in a try/catch. On error, they return `E.left(TEAM_COL_REORDERING_FAILED)` with no retry loop.

**Verdict:** The graph incorrectly attributes retry behavior to the reorder operation. No retry loop exists in `updateCollectionOrder`.

---

## Inconsistency 6: Destination locking in moveCollection locks wrong scope

**Graph claim (flows/collection-management/description.md, "Move collection" path):**
> "3. Lock destination's sibling set (if moving into a collection)"

**Source code (lines 810-814):**
```typescript
await this.prisma.lockTeamCollectionByTeamAndParent(
  tx,
  destCollection.right.teamID,
  destCollection.right.parentID,  // <-- locks destCollection's SIBLINGS, not destCollection's CHILDREN
);
```

The lock uses `destCollection.right.parentID`, which locks the siblings of the destination collection (i.e., the sibling set the destination collection belongs to). But the collection is being moved INTO `destCollection` (becoming a child of `destCollection`), so the graph's claim of "Lock destination's sibling set" is ambiguous at best. The code locks the destination's parent-level siblings, not the children of the destination (which is where the collection will actually be placed). The actual placement happens in `changeParentAndUpdateOrderIndex` which operates under `destCollection.right.id` as the parentID without an additional lock on that sibling set.

**Verdict:** The lock scope described in the graph is misleading. The code locks the siblings of the destination collection (its parent's children), but the moved collection becomes a child of the destination collection. The children of the destination collection (the actual sibling set for the moved collection) are not explicitly locked in the move operation.

---

## Inconsistency 7: isParent return values description is partially inaccurate

**Graph claim (logic.md, "isParent" section):**
> "1. If source === destination -> return None (invalid, means self-move)"

**Source code (lines 716-717):**
```typescript
if (collection === destCollection) {
  return O.none;
}
```

This checks **object reference equality** (`===` on objects), not logical ID equality. Since the code uses `getCollection` to fetch fresh objects, two separately fetched objects representing the same collection would NOT be reference-equal, meaning this check would not catch a self-move by ID. The actual self-move check by ID happens earlier in `moveCollection` (line 785: `if (collectionID === destCollectionID)`).

**Verdict:** The graph's characterization of step 1 as "means self-move" is misleading. In practice this reference equality check is essentially dead code because the caller already rejects self-move by ID comparison. The graph description implies the function handles self-move detection, but it actually does not in any practical sense.

---

## Inconsistency 8: PubSub events timing claim about delete

**Graph claim (pubsub-events/content.md, "Timing" section):**
> "The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds."

**Source code (lines 634-638):**
```typescript
this.pubsub.publish(
  `team_coll/${collection.right.teamID}/coll_removed`,
  collection.right.id,
);
```

The PubSub call for delete happens in `deleteCollection` (line 635), after `deleteCollectionAndUpdateSiblingsOrderIndex` returns. This is consistent with the graph claim that the PubSub happens after the retry loop succeeds. However, the graph claim implies this is an "exception" to the rule of "events published AFTER the database transaction commits." In reality, the delete PubSub follows the same pattern as all others (published after the operation completes). This is not an exception -- it is the standard pattern.

**Verdict:** Minor inaccuracy. The graph frames the delete PubSub timing as an "exception" when it actually follows the same pattern as all other operations.

---

## Inconsistency 9: Sort operation missing from retry-on-deadlock description

**Graph claim (retry-on-deadlock/content.md, "Where this applies"):**
> "Retries apply to create, move, and reorder operations"

**Source code (`sortTeamCollections`, lines 1502-1549):**
The sort operation also modifies sibling orderIndexes but has no retry loop. The graph does not mention sort at all in the retry-on-deadlock aspect, but sort is also missing a retry loop in the code, so this is consistent. However, the graph claims create/move/reorder HAVE retries (which is incorrect per Inconsistencies 3-5), while only delete actually has one.

**Verdict:** The graph's overall picture of which operations have retries is inverted. Only `deleteCollectionAndUpdateSiblingsOrderIndex` has a retry loop. Create, move, reorder, and sort all lack retry loops.

---

## Inconsistency 10: Sort operation not listed in flow participants or description

**Graph claim (flows/collection-management/description.md):**
Lists Create, Delete, Move, Reorder, Search, Import, Duplicate as paths. The trigger mentions "sort" but there is no Sort path described.

**Source code (`sortTeamCollections`, lines 1502-1549):**
A full sort operation exists that re-indexes all siblings by title (ascending or descending). This is a distinct mutation path not described in the flow.

**Verdict:** The flow description omits the sort operation despite it being a real mutation path in the source code.

---

## Inconsistency 11: `updateTeamCollection` not described in flow paths

**Graph claim (flows/collection-management/description.md):**
No explicit "Update collection" path exists. Only "Create", "Delete", "Move", "Reorder", "Search", "Import", and "Duplicate" are listed.

**Source code (`updateTeamCollection`, lines 1056-1091):**
A full update method exists that can update both title and data fields, with validation and PubSub event publishing (`coll_updated`). The deprecated `renameCollection` (lines 527-546) also exists.

**Verdict:** The flow description omits the update/rename operation despite it being a real mutation path in the source code.

---

## Inconsistency 12: Constraints document lists wrong error code name

**Graph claim (constraints.md, "Data field validation"):**
> "Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`."

**Source code (lines 467-471):**
```typescript
if (data === '') return E.left(TEAM_COLL_DATA_INVALID);
if (data) {
  const jsonReq = stringToJson(data);
  if (E.isLeft(jsonReq)) return E.left(TEAM_COLL_DATA_INVALID);
```

The error code in the source is `TEAM_COLL_DATA_INVALID`. The graph says `TEAM_COLL_DATA_INVALID`. These match. No inconsistency here on closer inspection.

**Verdict:** Consistent. (Removing this item.)

---

## Verified Claims (Consistent with Source Code)

The following graph claims were verified as correct:

1. **Pessimistic locking pattern** -- Lock is acquired via `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` before orderIndex reads. Confirmed in create, delete, import, reorder, move, and sort operations.

2. **Pessimistic locking scope** -- Locks are scoped to `(teamID, parentID)`. Confirmed.

3. **PubSub channel naming** -- All five channel patterns (`coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated`) are confirmed in source code.

4. **PubSub payload shapes** -- Added/Updated/Moved use `this.cast(collection)` (full model), Removed uses `collection.right.id` (just ID string), Order updated uses `{ collection, nextCollection }` pair. All confirmed.

5. **MAX_RETRIES = 5** -- Confirmed at line 60.

6. **Linear backoff `retryCount * 100`** -- Confirmed at line 609.

7. **Exhaustion returns `TEAM_COL_REORDERING_FAILED`** -- Confirmed at line 607.

8. **OrderIndex is 1-based** -- Confirmed: first collection gets orderIndex 1 (line 499), not 0.

9. **Circular reference prevention via `isParent`** -- Walk-up algorithm confirmed.

10. **Same-team constraint** -- `TEAM_COLL_NOT_SAME_TEAM` check confirmed in move (line 796) and reorder (line 946).

11. **Self-move prevention** -- `TEAM_COLL_DEST_SAME` at line 787 confirmed.

12. **Already-root guard** -- `TEAM_COL_ALREADY_ROOT` at line 763 confirmed.

13. **Title minimum length = 1** -- `TITLE_LENGTH = 1` at line 59 confirmed.

14. **Duplication uses export + import pattern** -- Confirmed in `duplicateTeamCollection` (lines 1469-1492).

15. **Search uses raw SQL with ILIKE and similarity()** -- Confirmed in `searchCollections` and `searchRequests`.

16. **Parent tree uses recursive CTE (WITH RECURSIVE)** -- Confirmed in `fetchCollectionParentTree` and `fetchRequestParentTree`.

17. **fp-ts Either pattern for errors** -- Confirmed throughout: all business errors return `E.left()`.

18. **`isParent` walks up, not down** -- Confirmed: follows `parentID` links upward.

19. **Reorder algorithm** -- Move-to-end and move-to-specific-position logic matches the graph description in logic.md.

20. **`changeParentAndUpdateOrderIndex` modifies both source and destination parents** -- Confirmed: decrements source siblings then assigns under new parent.

---

## Critical Findings Summary

| # | Severity | Inconsistency |
|---|----------|---------------|
| 1 | **HIGH** | Delete DOES have retries -- graph claims it does not (inversion) |
| 2 | **MEDIUM** | aspect.yaml says "Exponential" but backoff is linear (internal contradiction) |
| 3 | **HIGH** | Create does NOT have retries -- graph claims it does (incorrect attribution) |
| 4 | **HIGH** | Move does NOT have retries -- graph claims it does (incorrect attribution) |
| 5 | **HIGH** | Reorder does NOT have retries -- graph claims it does (incorrect attribution) |
| 6 | **MEDIUM** | Move operation locks destination's parent-siblings, not destination's children (scope error) |
| 7 | **LOW** | isParent self-move check uses reference equality, essentially dead code |
| 8 | **LOW** | Delete PubSub timing described as "exception" but follows standard pattern |
| 9 | **HIGH** | Retry attribution is completely inverted: only delete has retries, graph says only delete lacks them |
| 10 | **MEDIUM** | Sort operation path missing from flow description |
| 11 | **MEDIUM** | Update/rename operation path missing from flow description |

The most significant finding is that the retry behavior attribution is completely inverted across the graph. The graph consistently states that create, move, and reorder have retries while delete does not. In reality, only the delete helper (`deleteCollectionAndUpdateSiblingsOrderIndex`) has a retry loop. Create, move, and reorder all use simple try/catch with no retry mechanism.
