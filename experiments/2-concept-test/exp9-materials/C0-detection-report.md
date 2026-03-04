# C0 Detection Report: TeamCollectionService Graph vs Source Code

## Summary

Reviewed all graph artifacts under `/workspaces/memory2/exp9-materials/C0/` against the source code at `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`.

**Result: Several inconsistencies found.**

---

## Inconsistencies Found

### 1. INCORRECT — `retry-on-deadlock/content.md` claims "exponential backoff" in the aspect description title, but strategy section correctly says "linear backoff"

- **Graph (aspect.yaml `description` field):** "Exponential retry for specific database transaction errors"
- **Graph (content.md body):** "linear backoff `retryCount * 100ms`"
- **Source code (line 609):** `await delay(retryCount * 100);` — this is linear backoff, not exponential.
- **Verdict:** The `aspect.yaml` `description` field says "Exponential retry" which contradicts both the content.md body (which correctly says linear) and the source code. The aspect.yaml description is inconsistent.

### 2. INCORRECT — `constraints.md` claims orderIndex is "contiguous starting from 1"

- **Graph (`constraints.md`):** "Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1."
- **Source code (line 231, `importCollectionsFromJSON`):** `let lastOrderIndex = lastEntry ? lastEntry.orderIndex : 0;` then `++lastOrderIndex` — so the first item gets orderIndex 1. This is consistent.
- **Source code (line 499, `createCollection`):** `orderIndex: lastCollection ? lastCollection.orderIndex + 1 : 1` — also starts at 1. Consistent.
- **Source code (line 912, `updateCollectionOrder` move-to-end):** Sets orderIndex to `this.getCollectionCount(...)`. `getCollectionCount` (line 850) returns `count()` of siblings. After decrementing others, the count equals the last valid index. However, if we have items [1,2,3] and move item at index 1 to the end: after decrement, items 2,3 become [1,2], count=3 (including the item being moved), so the moved item gets orderIndex=3. This is correct.
- **Verdict:** Consistent on this point after careful analysis.

### 3. INCORRECT — `logic.md` reorder algorithm "Move to end" step 4 description

- **Graph (`logic.md`):** "Set collection's orderIndex = total count of siblings (puts it at the end)"
- **Source code (lines 912-917):** Uses `this.getCollectionCount(collection.right.parentID, collection.right.teamID, tx)` which counts ALL collections under that parent (including the collection being moved). This is the total count of siblings including self, not strictly "total count of siblings" (which could be interpreted as excluding self).
- **Verdict:** Minor ambiguity but not strictly wrong since the collection is a sibling of itself in the count query. Borderline — marking as minor.

### 4. INCORRECT — `logic.md` `isParent` return value description

- **Graph (`logic.md`):** "If source === destination → return None (invalid, means self-move)"
- **Source code (line 716):** `if (collection === destCollection)` — this uses JavaScript reference equality (`===`), NOT value/ID equality. Since `collection` and `destCollection` are different objects fetched from the database, this comparison will almost always be `false` even for the same collection ID. The graph describes the semantic intent but the code uses reference comparison, which is a different behavior.
- **Verdict:** The graph describes the intended behavior (checking if same collection) but the code uses reference equality on objects, which would not catch the case where the same collection ID is passed as both arguments (since they'd be different object references). However, `moveCollection` (line 785) already checks `collectionID === destCollectionID` (string comparison) before calling `isParent`, so this dead code path is guarded at a higher level. The graph description is still technically inaccurate about what the code actually does at the `isParent` level.

### 5. INCORRECT — `pubsub-events/content.md` claims events are published "AFTER the database transaction commits"

- **Graph (`pubsub-events/content.md`):** "Events are published AFTER the database transaction commits successfully."
- **Source code — `moveCollection` (lines 776-778 and 825-828):** PubSub `publish` for `coll_moved` is called INSIDE the `$transaction` callback (within the `return await this.prisma.$transaction(async (tx) => { ... })` block), meaning it fires BEFORE the transaction commits (it's part of the transaction body).
- **Verdict:** INCONSISTENT. The `moveCollection` method publishes `coll_moved` events inside the transaction callback, not after it commits. By contrast, `createCollection` (line 511) and `deleteCollection` (line 635) correctly publish after the transaction. This is a genuine inconsistency between the graph claim and the code behavior for `moveCollection`.

### 6. INCORRECT — `flow.yaml` description for Move collection says "Lock destination's sibling set"

- **Graph (`description.md`, Move collection step 3):** "Lock destination's sibling set (if moving into a collection)"
- **Source code (lines 810-814):** The lock is on `destCollection.right.teamID` and `destCollection.right.parentID` — this locks the siblings of the destination collection (i.e., collections with the same parent as the destination), NOT the children of the destination (which is where the moved collection would end up).
- **Source code, `changeParentAndUpdateOrderIndex` (line 656-659):** The actual new parent is `destCollection.right.id`, and siblings under this new parent are fetched, but no lock is acquired for them.
- **Verdict:** INCONSISTENT. The code locks the destination's siblings (same parent as destination), not the destination's children (where the collection will actually be placed). The graph's description "Lock destination's sibling set" is ambiguous, but in context it suggests locking the siblings under the new parent, which is not what happens.

### 7. MISSING — `responsibility.md` does not mention `sortTeamCollections`

- **Graph (`responsibility.md`, "In scope"):** Lists "Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings" — this does mention "sort siblings."
- **Source code (lines 1502-1549):** `sortTeamCollections` method exists and sorts by title ascending/descending.
- **Verdict:** Consistent. Sort is mentioned in the responsibility.

### 8. MISSING — `responsibility.md` does not mention `totalCollectionsInTeam` or `getTeamCollectionsCount`

- **Source code (lines 1028-1046):** `totalCollectionsInTeam` and `getTeamCollectionsCount` are utility/count methods.
- **Graph:** These are not explicitly mentioned in any artifact.
- **Verdict:** Minor omission. These are simple count/utility methods and may not warrant explicit mention.

### 9. MISSING — `responsibility.md` does not mention `renameCollection` (deprecated method)

- **Source code (line 520-546):** `renameCollection` is marked as `@deprecated` in favor of `updateTeamCollection`.
- **Graph (`responsibility.md`):** Mentions "update (title/data)" but does not mention the deprecated rename method.
- **Verdict:** Minor omission. The deprecated method is covered by the general "update" mention.

### 10. INCORRECT — `responsibility.md` "In scope" mentions only `getCollectionForCLI` and `getCollectionTreeForCLI`

- **Graph (`responsibility.md`):** "CLI support: `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access"
- **Source code:** `getCollectionForCLI` is a public method (line 1438), but `getCollectionTreeForCLI` is a private method (line 1407). The graph lists them as parallel public-facing features, but the private method is just an internal helper used by the public one.
- **Verdict:** Minor inaccuracy. Both methods exist but the graph implies both are part of the service's public API, when only `getCollectionForCLI` is public.

### 11. INCORRECT — `constraints.md` "Data field validation" says "Empty string is explicitly rejected (not treated as null)"

- **Graph (`constraints.md`):** "Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`."
- **Source code, `createCollection` (line 467):** `if (data === '') return E.left(TEAM_COLL_DATA_INVALID);` — rejects empty string with `TEAM_COLL_DATA_INVALID` (not a separate error).
- **Source code, `updateTeamCollection` (line 1067):** Same pattern.
- **Verdict:** Consistent. The graph accurately describes the behavior.

### 12. INCORRECT — `decisions.md` "Why delete has retries but other mutations do not" reasoning

- **Graph (`decisions.md`):** "The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs."
- **Source code:** The retry loop in `deleteCollectionAndUpdateSiblingsOrderIndex` catches errors OUTSIDE the transaction (line 595-611), meaning the entire transaction failed. The lock is acquired inside the transaction. Two concurrent deletes on overlapping sibling sets could indeed deadlock.
- **Verdict:** Consistent.

### 13. MISSING — `sortTeamCollections` does not publish any PubSub event

- **Graph (`pubsub-events/content.md`):** "Every mutation to a team collection publishes a PubSub event so that connected clients receive real-time updates."
- **Source code (lines 1502-1549):** `sortTeamCollections` modifies orderIndex values of potentially ALL siblings but does NOT publish any PubSub event.
- **Graph (`flows/collection-management/description.md`, invariants):** "Every successful mutation publishes a PubSub event for real-time clients"
- **Verdict:** INCONSISTENT. The `sortTeamCollections` method is a mutation that changes orderIndex values but publishes no PubSub event, violating the stated invariant that "every mutation publishes a PubSub event."

### 14. INCORRECT — `flow description.md` Create collection step 5

- **Graph (`description.md`, Create collection step 5):** "Create collection with orderIndex = last + 1 (or 1 if first)"
- **Source code (line 499):** `orderIndex: lastCollection ? lastCollection.orderIndex + 1 : 1`
- **Verdict:** Consistent.

### 15. MISSING — Graph does not mention `updateTeamCollection` method's behavior

- **Graph (`responsibility.md`):** Mentions "update (title/data)" in scope.
- **Graph (`constraints.md`):** Documents title minimum length and data validation.
- **Source code (lines 1056-1091):** `updateTeamCollection` allows updating title and/or data independently (both are optional). The method publishes `coll_updated`.
- **Verdict:** Consistent at a high level.

### 16. INCORRECT — `flow description.md` Move collection does not mention that the destination lock is on the wrong level

- **Graph (`description.md`, Move collection steps 2-3):** "Lock source's current sibling set" and "Lock destination's sibling set (if moving into a collection)"
- **Source code (lines 809-814):** Locks `destCollection.right.parentID` (destination's parent's children), not `destCollectionID`'s children (the actual destination for the move).
- **Verdict:** Already covered in item 6, but worth noting the flow description inherits the same inaccuracy.

---

## Verified Correct Claims

The following graph claims were verified as **consistent** with the source code:

1. **TITLE_LENGTH = 1** — Source line 59: `TITLE_LENGTH = 1;`
2. **MAX_RETRIES = 5** — Source line 60: `MAX_RETRIES = 5;`
3. **Linear backoff with `retryCount * 100ms`** — Source line 609: `await delay(retryCount * 100);`
4. **Retry error codes: UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT** — Source lines 603-605.
5. **On exhaustion returns `E.left(TEAM_COL_REORDERING_FAILED)`** — Source line 607.
6. **`isParent` walks up from destination to root** — Source lines 696-737 confirm recursive upward walk.
7. **Duplication uses export + import with " - Duplicate" suffix** — Source line 1483: `name: \`${collection.right.title} - Duplicate\``
8. **Search uses raw SQL with ILIKE and similarity()** — Source lines 1176-1189 and 1214-1227.
9. **Parent tree reconstruction uses recursive CTE** — Source lines 1257-1270 and 1346-1359.
10. **PubSub channel naming matches documented pattern** — Verified across all publish calls.
11. **Removed event payload is collection ID string** — Source line 637: `collection.right.id`
12. **Order updated event payload is `{ collection, nextCollection }`** — Source lines 926-930 and 1010-1014.
13. **`changeParentAndUpdateOrderIndex` is a two-parent operation** — Source lines 650-687 confirm modification of both source and destination parent sibling sets.
14. **Reorder algorithm direction logic** — Source lines 971-1001 match the graph description in `logic.md`.
15. **Error codes match** — All documented error codes exist in the imports (lines 5-22).
16. **fp-ts Either usage** — All business errors use `E.left()`, not exceptions.
17. **Pessimistic locking uses `lockTeamCollectionByTeamAndParent`** — Confirmed in multiple methods.
18. **Lock scope is `(teamID, parentID)`** — Confirmed by the lock function parameters.
19. **Same-team constraint on move** — Source line 795: checks `collection.right.teamID !== destCollection.right.teamID`.
20. **Already-root guard** — Source lines 760-763: rejects with `TEAM_COL_ALREADY_ROOT`.
21. **Self-move prevention** — Source line 785: checks `collectionID === destCollectionID`.

---

## Summary of All Inconsistencies

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | Minor | `retry-on-deadlock/aspect.yaml` | Description says "Exponential retry" but strategy is linear backoff |
| 5 | Major | `pubsub-events/content.md` | Claims events published AFTER transaction commit, but `moveCollection` publishes INSIDE the transaction callback |
| 6 | Major | `flows/.../description.md` + code | Move collection locks destination's parent-level siblings, not destination's children (where the moved collection lands) |
| 13 | Major | `pubsub-events/content.md` + flow invariants | `sortTeamCollections` mutates orderIndex but publishes no PubSub event, violating the "every mutation publishes" invariant |
| 4 | Minor | `logic.md` | `isParent` source === destination check uses object reference equality, not ID equality |
| 10 | Minor | `responsibility.md` | Implies `getCollectionTreeForCLI` is a public API feature, but it is a private helper method |
