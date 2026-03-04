# C5 Detection Report: TeamCollectionService Graph vs Source Code

## Source File

`/workspaces/hoppscotch/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`

---

## INCONSISTENCIES FOUND

### 1. FACTUAL ERROR — retry-on-deadlock aspect.yaml says "Exponential retry" but strategy is linear

**Graph claim (aspect.yaml, line 2):**
> `description: Exponential retry for specific database transaction errors`

**Graph claim (content.md, line 17):**
> Delay: linear backoff `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)

**Graph claim (content.md, line 21):**
> "Why linear, not exponential" section explicitly says it is NOT exponential.

**Source code (line 609):**
```ts
await delay(retryCount * 100);
```

**Verdict:** Internal contradiction within the graph itself. The `aspect.yaml` description says "Exponential retry" while the `content.md` explicitly describes linear backoff and even has a section titled "Why linear, not exponential." The code confirms it is linear (`retryCount * 100`). The aspect.yaml description is factually wrong.

---

### 2. FACTUAL ERROR — Move flow step ordering is wrong (isParent check vs destination lock)

**Graph claim (flows/collection-management/description.md, Move collection path):**
> 2. Lock source's current sibling set
> 3. Lock destination's sibling set (if moving into a collection)
> 4. Recursive `isParent` check: walk up from destination to root...

**Source code (lines 746-835):**
The actual order in `moveCollection` is:
1. Lock source's sibling set (line 753)
2. Get dest collection (line 791)
3. Check same team (line 795)
4. `isParent` check (line 800) -- **BEFORE destination lock**
5. Lock destination's siblings (line 810) -- **AFTER isParent check**
6. `changeParentAndUpdateOrderIndex` (line 818)

**Verdict:** The flow description puts the isParent check at step 4 after the destination lock at step 3. In the actual code, the isParent check happens BEFORE the destination sibling lock. The ordering is reversed compared to what the graph describes.

---

### 3. FACTUAL ERROR — Move flow locks destination's parent siblings, not destination's children

**Graph claim (flows/collection-management/description.md, Move step 3):**
> Lock destination's sibling set (if moving into a collection)

**Graph claim (flows/collection-management/description.md, Move step 6):**
> Assign source to new parent with orderIndex = last + 1 under new parent

**Source code (lines 810-814):**
```ts
await this.prisma.lockTeamCollectionByTeamAndParent(
    tx,
    destCollection.right.teamID,
    destCollection.right.parentID,  // <-- locks destination's PARENT'S children (destination's siblings)
);
```

But `changeParentAndUpdateOrderIndex` at line 818-821 sets `newParentID = destCollection.right.id`, meaning the moved collection becomes a **child** of the destination. The children of the destination (the moved collection's new siblings) are never explicitly locked.

**Verdict:** The graph says "Lock destination's sibling set" which is ambiguous but close to what the code does. However, this is misleading because the collection is being moved INTO the destination (becoming its child), so the relevant sibling set that should be locked is the destination's CHILDREN (the future siblings), not the destination's own siblings. The code locks the wrong set, and the graph does not identify this discrepancy.

---

### 4. FACTUAL ERROR — sortTeamCollections does NOT publish a PubSub event, violating stated invariant

**Graph claim (flows/collection-management/description.md, Invariants):**
> Every successful mutation publishes a PubSub event for real-time clients

**Graph claim (aspects/pubsub-events/content.md):**
> Every mutation to a team collection publishes a PubSub event

**Source code (lines 1502-1549):**
`sortTeamCollections` modifies orderIndex values (a mutation) and returns `E.right(true)` on success but contains NO `pubsub.publish()` call anywhere in the method.

**Verdict:** The invariant "every mutation publishes a PubSub event" is factually violated by `sortTeamCollections`. The graph states this invariant without noting the exception. This is a genuine missing PubSub event in the code, not documented in the graph.

---

### 5. FABRICATED RATIONALE — Why orderIndex is integer-based, not fractional

**Graph claim (decisions.md):**
> Integer orderIndex was chosen because the Prisma ORM used by Hoppscotch has poor support for decimal/float columns in PostgreSQL. Prisma's `Decimal` type maps to `@db.Decimal` which introduces significant overhead in serialization and comparison operations, and Prisma's query builder does not support `updateMany` with arithmetic on float columns reliably -- rounding errors can cause `WHERE orderIndex > 3.5` to miss or include unexpected rows. Using integers avoids these ORM-layer precision issues entirely and ensures that Prisma's generated SQL produces exact matches.

**Source code evidence:** There is zero evidence in the source code for this rationale. No comments mention Decimal types, float precision issues, or any alternative ordering approach that was considered and rejected. The code simply uses integer `orderIndex` throughout without any indication of why.

**Verdict:** This rationale reads as a plausible-sounding but fabricated justification. The specific claims about Prisma's `Decimal` type behavior, `@db.Decimal` mapping overhead, and `updateMany` rounding errors are highly specific technical details that appear nowhere in the codebase and cannot be verified from the source. This is a classic hallucinated rationale -- detailed enough to sound authoritative but entirely unsupported by code evidence.

---

### 6. FABRICATED RATIONALE — Why delete has retries but other mutations do not

**Graph claim (decisions.md):**
> Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs. The retry loop handles these transient deadlocks. Create and move operations are less prone to this because they typically modify non-overlapping index ranges (append at end, or shift in one direction).

**Source code evidence:** The code has the retry loop only in `deleteCollectionAndUpdateSiblingsOrderIndex`. There is no comment explaining WHY only delete has retries. The explanation about "concurrent deletes racing" and "lock acquisition order" is technically plausible but entirely fabricated -- no code comment or documentation substantiates this reasoning.

**Verdict:** Likely fabricated rationale. The observation that only delete has retries is factually correct, but the explanation about WHY (concurrent deletes racing with overlapping lock acquisition) is an invented justification with no code evidence. The actual reason could be simpler (e.g., the developer observed deadlocks during delete operations and added retries as a pragmatic fix, without applying the same pattern to other operations).

---

### 7. FABRICATED RATIONALE — Why pessimistic, not optimistic locking

**Graph claim (aspects/pessimistic-locking/content.md):**
> Optimistic locking (version columns + retry on conflict) would require every collection row to carry a version field and every read to include it. Since reorder operations often touch MANY siblings (updateMany with range conditions), optimistic locking would be impractical -- a single conflicting row would invalidate the entire batch. Pessimistic locking serializes access to the sibling set, which is the correct granularity.

**Source code evidence:** There is no mention of optimistic locking, version columns, or any alternative locking strategy anywhere in the source code. The code simply uses pessimistic locking via `lockTeamCollectionByTeamAndParent`.

**Verdict:** Fabricated rationale. The analysis of why optimistic locking would be impractical is logically sound but entirely invented. No code comment or documentation discusses this trade-off. This is a post-hoc rationalization presented as an actual design decision.

---

### 8. FABRICATED RATIONALE — Why `isParent` walks up, not down

**Graph claim (decisions.md):**
> To check if Collection_A is an ancestor of Collection_D, the code walks UP from D to root (following parentID links), checking if any parent is A. The alternative -- walking DOWN from A through all descendants -- would require loading the entire subtree. Walking up follows a single chain of parentID pointers, which is O(depth) not O(subtree_size).

**Source code evidence:** The code does walk up from the destination to the root (verified in `isParent` method, lines 696-737). The comments in the code only explain WHAT the method does, not WHY this approach was chosen over alternatives. No comment discusses the alternative of walking down.

**Verdict:** The factual claim (walks up) is correct. The rationale (O(depth) vs O(subtree_size)) is logically valid but fabricated -- there is no evidence in the code that this trade-off was actually considered. It could simply be that walking up via parentID is the most natural implementation given the data model (each node has a `parentID` but there is no `children` array readily available without a query).

---

### 9. MINOR FACTUAL INACCURACY — isParent logic description step 1

**Graph claim (logic.md, isParent step 1):**
> If source === destination -> return None (invalid, means self-move)

**Source code (line 716):**
```ts
if (collection === destCollection) {
    return O.none;
}
```

**Verdict:** The code uses JavaScript reference equality (`===` on objects), not value/ID equality. In the context of `moveCollection`, this check is redundant because the `collectionID === destCollectionID` check at line 785 already prevents the same-ID case. The graph's description "means self-move" is a slight mischaracterization -- the reference equality check would only trigger if the exact same object instance were passed twice, which in practice would not happen through `moveCollection` since two separate `getCollection` calls return different objects. This is a minor accuracy issue.

---

### 10. FACTUAL OMISSION — PubSub event for move-to-root path does not lock destination

**Graph claim (flows/collection-management/description.md, Move step 3):**
> Lock destination's sibling set (if moving into a collection)

**Source code (lines 759-781):**
When moving to root (`destCollectionID` is null), the code calls `changeParentAndUpdateOrderIndex(tx, collection.right, null)` which modifies root-level collections' orderIndexes. The root-level sibling set (parentID=null) is NOT locked before this mutation. Only the source's original sibling set is locked.

**Verdict:** The flow's parenthetical "(if moving into a collection)" acknowledges this gap, but the code's `changeParentAndUpdateOrderIndex` still modifies the root sibling set (finds last orderIndex at root, assigns new orderIndex). The invariant "Every sibling-order mutation acquires a pessimistic row lock before reading orderIndex values" is violated for the destination side of move-to-root operations. The graph does not flag this inconsistency.

---

## CLAIMS VERIFIED AS CORRECT

1. **TITLE_LENGTH = 1** -- Confirmed at line 59.
2. **MAX_RETRIES = 5** -- Confirmed at line 60.
3. **Retry delay = retryCount * 100ms** -- Confirmed at line 609.
4. **Retry error codes: UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT** -- Confirmed at lines 603-605.
5. **On retry exhaustion: returns E.left(TEAM_COL_REORDERING_FAILED)** -- Confirmed at line 607.
6. **PubSub channels naming convention** -- All confirmed: `coll_added` (lines 265, 512), `coll_updated` (lines 538, 1083), `coll_removed` (line 636), `coll_moved` (lines 777, 825), `coll_order_updated` (lines 926, 1010).
7. **Removed event payload is just collection ID** -- Confirmed at line 637.
8. **Order updated event payload is `{ collection, nextCollection }`** -- Confirmed at lines 927-930 and 1011-1014.
9. **Duplication uses export + import pattern with " - Duplicate" suffix** -- Confirmed at lines 1469-1492, title modification at line 1483.
10. **Search uses raw SQL with ILIKE and similarity()** -- Confirmed at lines 1176-1189 and 1214-1227.
11. **Parent tree reconstruction uses WITH RECURSIVE CTE** -- Confirmed at lines 1257-1271 and 1347-1359.
12. **fp-ts Either for business errors** -- Confirmed throughout (E.left/E.right pattern used universally).
13. **Self-move prevention (TEAM_COLL_DEST_SAME)** -- Confirmed at line 787.
14. **Same-next-collection prevention (TEAM_COL_SAME_NEXT_COLL)** -- Confirmed at line 868.
15. **Already-root guard (TEAM_COL_ALREADY_ROOT)** -- Confirmed at line 763.
16. **Same-team constraint (TEAM_COLL_NOT_SAME_TEAM)** -- Confirmed at line 796.
17. **Data field validation (empty string rejected, invalid JSON rejected)** -- Confirmed at lines 467-471 and 1067-1072.
18. **Create orderIndex = last + 1 or 1 if first** -- Confirmed at line 499.
19. **Reorder algorithm (move to end and move to specific position)** -- Confirmed at lines 862-1021, including the direction logic.
20. **CLI support methods** -- `getCollectionForCLI` and `getCollectionTreeForCLI` confirmed at lines 1407-1461.
21. **Retry only in deleteCollectionAndUpdateSiblingsOrderIndex** -- Confirmed (only retry loop in the file).
22. **Events published AFTER transaction commits** -- Confirmed (pubsub.publish calls are outside the $transaction blocks).

---

## SUMMARY

| Category | Count | Severity |
|----------|-------|----------|
| Factual errors | 4 | High |
| Fabricated rationales | 4 | Medium-High |
| Minor inaccuracies | 1 | Low |
| Factual omissions | 1 | Medium |
| **Total inconsistencies** | **10** | |
| Verified correct claims | 22 | -- |

The graph is broadly accurate in its factual descriptions of what the code does, with most method behaviors, error codes, and patterns correctly captured. However, it contains:

- **4 fabricated rationales** that present plausible-sounding but unsubstantiated reasons for design decisions (integer orderIndex, delete-only retries, pessimistic over optimistic locking, isParent walk direction). These read as post-hoc rationalizations, not documented decisions.
- **4 factual errors** including an internal contradiction (exponential vs linear), wrong step ordering in the move flow, incorrect lock target description, and an unacknowledged violation of the PubSub invariant by sortTeamCollections.
- **1 factual omission** about the move-to-root path not locking the destination sibling set.
