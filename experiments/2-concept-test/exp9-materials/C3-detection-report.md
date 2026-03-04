# C3 Graph-vs-Source Inconsistency Detection Report

## Module Under Review

- **Graph node:** `model/team-collections/team-collection-service/`
- **Source file:** `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`

---

## Inconsistencies Found

### 1. CRITICAL — Reorder algorithm ("Move to end") is fundamentally wrong in the graph

**Graph claim** (logic.md, lines 7-14):
> ### Move to end (nextCollectionID = null)
> 1. Lock siblings
> 2. Re-read collection's current orderIndex inside transaction (race condition guard)
> 3. Find the sibling currently at the last position (highest orderIndex)
> 4. Swap the orderIndex values of the collection and the last sibling (direct swap of two rows)
> 5. If the collection is already last, no-op

**Actual code** (lines 876-936):
```typescript
// Step 1: Decrement orderIndex of all items that come after collection.orderIndex till end of list of items
await tx.teamCollection.updateMany({
  where: {
    teamID: collection.right.teamID,
    parentID: collection.right.parentID,
    orderIndex: {
      gte: collectionInTx.orderIndex + 1,
    },
  },
  data: {
    orderIndex: { decrement: 1 },
  },
});

// Step 2: Update orderIndex of collection to length of list
await tx.teamCollection.update({
  where: { id: collection.right.id },
  data: {
    orderIndex: await this.getCollectionCount(
      collection.right.parentID,
      collection.right.teamID,
      tx,
    ),
  },
});
```

**Discrepancy:** The graph describes a **direct swap** of two rows (the collection and the last sibling). The actual code performs a **gap-fill + append** operation: it decrements all siblings after the collection's current position by 1, then sets the collection's orderIndex to the total count of siblings. This is a fundamentally different algorithm. The graph's "swap" description would only move two items; the real code shifts an entire range of siblings.

---

### 2. CRITICAL — Reorder algorithm ("Move to specific position") is fundamentally wrong in the graph

**Graph claim** (logic.md, lines 16-22):
> ### Move to specific position (nextCollectionID != null)
> 1. Lock siblings
> 2. Re-read BOTH collection and nextCollection orderIndex inside transaction
> 3. Swap the orderIndex values of the two collections directly — the source collection takes the target's orderIndex, and the target takes the source's orderIndex
> 4. No other siblings are modified; only the two involved collections exchange positions
>
> The "next collection" semantics mean: "swap my position with this collection."

**Actual code** (lines 948-1007):
```typescript
// Step 1: Determine if we are moving collection up or down the list
const isMovingUp =
  subsequentCollectionInTx.orderIndex < collectionInTx.orderIndex;

// Step 2: Update OrderIndex of items in list depending on moving up or down
const updateFrom = isMovingUp
  ? subsequentCollectionInTx.orderIndex
  : collectionInTx.orderIndex + 1;
const updateTo = isMovingUp
  ? collectionInTx.orderIndex - 1
  : subsequentCollectionInTx.orderIndex - 1;

await tx.teamCollection.updateMany({
  where: {
    teamID: collection.right.teamID,
    parentID: collection.right.parentID,
    orderIndex: { gte: updateFrom, lte: updateTo },
  },
  data: {
    orderIndex: isMovingUp ? { increment: 1 } : { decrement: 1 },
  },
});

// Step 3: Update OrderIndex of collection
await tx.teamCollection.update({
  where: { id: collection.right.id },
  data: {
    orderIndex: isMovingUp
      ? subsequentCollectionInTx.orderIndex
      : subsequentCollectionInTx.orderIndex - 1,
  },
});
```

**Discrepancy:** The graph claims a **direct swap of two collections** where "no other siblings are modified." The actual code performs a **range shift**: it determines direction (up/down), shifts all siblings in the affected range by +1 or -1, then places the collection at the target position. This modifies potentially many siblings, not just two. The graph's "swap" semantic description is completely wrong.

---

### 3. MODERATE — Retry aspect says "exponential backoff" in the title but describes linear — consistent internally, but aspect.yaml says "Exponential retry"

**Graph claim** (aspects/retry-on-deadlock/aspect.yaml, line 2):
> `description: Exponential retry for specific database transaction errors`

**Graph claim** (aspects/retry-on-deadlock/content.md, lines 16-17):
> - Delay: linear backoff `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)

**Actual code** (line 609):
```typescript
await delay(retryCount * 100);
```

**Discrepancy:** The aspect.yaml `description` field says "**Exponential** retry" but the actual behavior (both in the content.md and the code) is **linear** backoff. The content.md section "Why linear, not exponential" correctly explains this. The aspect.yaml description contradicts both the code and the content.md's own explanation.

---

### 4. MODERATE — PubSub aspect claims "coll_removed" payload is "collection ID, not full object" — partially misleading

**Graph claim** (aspects/pubsub-events/content.md, line 9):
> `team_coll/${teamID}/coll_removed` — collection deleted (payload: collection ID, not full object)

**Actual code** (lines 635-638):
```typescript
this.pubsub.publish(
  `team_coll/${collection.right.teamID}/coll_removed`,
  collection.right.id,
);
```

**Verification:** This claim is **correct**. The payload is `collection.right.id`, which is a string ID. No inconsistency here.

---

### 5. MODERATE — Move collection flow claims locking of "destination's sibling set" but code locks destination's PARENT's sibling set

**Graph claim** (flows/collection-management/description.md, lines 42-43):
> 2. Lock source's current sibling set
> 3. Lock destination's sibling set (if moving into a collection)

**Actual code** (lines 809-814):
```typescript
// lock the rows of the destination collection and its siblings
await this.prisma.lockTeamCollectionByTeamAndParent(
  tx,
  destCollection.right.teamID,
  destCollection.right.parentID,    // <-- locks dest's PARENT's sibling set
);
```

**Discrepancy:** The graph says the code locks the "destination's sibling set." The code actually locks the sibling set of the **destination's parent** (`destCollection.right.parentID`), which is the siblings of the destination collection, not the children under the destination. Since the collection is being moved INTO the destination, the relevant lock should be on the destination's children (the new sibling set), but the code locks the destination's own siblings instead. The flow description doesn't accurately describe which lock is acquired. The `changeParentAndUpdateOrderIndex` function does NOT separately lock the destination's children.

---

### 6. MODERATE — Move collection flow omits the "already root" guard from its description

**Graph claim** (flows/collection-management/description.md, lines 39-47):
The "Move collection" path lists:
> 1. Validate: source != destination, same team, not moving into own descendant (circular reference check)

**Actual code** (lines 759-764):
```typescript
if (!destCollectionID) {
  if (!collection.right.parentID) {
    // Throw error if collection is already a root collection
    return E.left(TEAM_COL_ALREADY_ROOT);
  }
```

**Discrepancy:** The flow description's step 1 says "Validate: source != destination, same team, not moving into own descendant." It omits the "already-root" guard. In the code, when `destCollectionID` is null (move to root), the first check is whether the collection is already a root collection. The constraints.md document does mention this (`TEAM_COL_ALREADY_ROOT`), but the flow path omits this validation step. This is an inconsistency between the flow description and the code.

---

### 7. MINOR — Move collection does NOT lock the destination's new child sibling set

**Graph claim** (flows/collection-management/description.md, line 43):
> 3. Lock destination's sibling set (if moving into a collection)

**Graph claim** (pessimistic-locking/content.md, line 8):
> Call `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` — this locks all sibling rows under the given parent

**Actual code** (lines 809-814, plus `changeParentAndUpdateOrderIndex` at lines 650-687):
The move operation locks the source's siblings and the destination collection's siblings (its parent's children), but it never locks the **children of the destination** (i.e., the new sibling set where the moved collection will end up). The `changeParentAndUpdateOrderIndex` method does not acquire a lock before reading `lastCollectionUnderNewParent`.

**Discrepancy:** The pessimistic-locking aspect states that "every operation that reads and then modifies sibling orderIndex values must acquire a row lock first." The move operation modifies the collection's orderIndex in the destination's child set without locking those children first. The code doesn't follow the stated aspect invariant for the destination side of a move.

---

### 8. MINOR — `isParent` graph description inverts return semantics for the identity case

**Graph claim** (logic.md, lines 27-28):
> 1. If source === destination -> return None (invalid, means self-move)

**Actual code** (lines 716-718):
```typescript
if (collection === destCollection) {
  return O.none;
}
```

**Note:** The code uses reference equality (`===` on objects), not value/ID equality. This is technically an implementation detail, but could yield `O.some(true)` (safe to move) even when the IDs match if they are different object references. The graph description is conceptually aligned but doesn't capture this subtle detail. The `moveCollection` caller does separately check `collectionID === destCollectionID` (line 785) using string ID comparison, so the identity check in `isParent` via `===` on objects is effectively redundant and unreliable.

---

### 9. MINOR — Graph does not document the `sortTeamCollections` method

**Source code** (lines 1502-1549): The `sortTeamCollections` method sorts all children under a parent by title (ascending or descending) within a transaction, re-assigning orderIndex values 1..N.

**Graph coverage:** The flow description mentions "sort" in the trigger list (line 9: "reorder, sort") but provides no dedicated path for sorting. The responsibility.md lists "sort siblings" in scope. However, the logic.md, constraints.md, and decisions.md do not document the sort algorithm or its behavior. This is an omission rather than an active inconsistency.

---

### 10. MINOR — PubSub timing claim partially inaccurate for sortTeamCollections

**Graph claim** (aspects/pubsub-events/content.md, lines 14-15):
> Events are published AFTER the database transaction commits successfully.

**Actual code** (lines 1517-1548): The `sortTeamCollections` method does NOT publish any PubSub event at all. It modifies orderIndex values for potentially all children under a parent but publishes no event to notify connected clients. This contradicts the aspect's claim that "every mutation to a team collection publishes a PubSub event."

---

### 11. MINOR — Duplicate collection title suffix description accurate but import mechanism detail is incomplete

**Graph claim** (flows/collection-management/description.md, lines 75-78):
> 1. Export collection to JSON (recursive)
> 2. Append " - Duplicate" to title
> 3. Import the modified JSON under the same parent
> 4. Reuses import flow, which handles locking and ordering

**Actual code** (lines 1469-1492):
```typescript
const result = await this.importCollectionsFromJSON(
  JSON.stringify([
    {
      ...collectionJSONObject.right,
      name: `${collection.right.title} - Duplicate`,
    },
  ]),
  collection.right.teamID,
  collection.right.parentID,
);
```

**Verification:** This is **accurate**. The title is appended with " - Duplicate" (using template literal on `collection.right.title`, not on the exported JSON `name`), and the result is re-imported under the same parent. No inconsistency.

---

## Summary

| # | Severity | Artifact | Issue |
|---|----------|----------|-------|
| 1 | CRITICAL | logic.md (Move to end) | Graph says "swap two rows"; code does gap-fill + append shifting all later siblings |
| 2 | CRITICAL | logic.md (Move to specific position) | Graph says "swap two collections, no others modified"; code shifts an entire range of siblings |
| 3 | MODERATE | aspect.yaml (retry-on-deadlock) | Description says "Exponential retry" but code and content.md both describe linear backoff |
| 4 | MODERATE | flow description (Move collection) | Says "lock destination's sibling set" but code locks destination's PARENT's sibling set (wrong scope) |
| 5 | MODERATE | flow description (Move collection) | Omits the "already-root" guard (`TEAM_COL_ALREADY_ROOT`) from the validation steps |
| 6 | MINOR | pessimistic-locking aspect + move code | Move operation doesn't lock the destination's child sibling set before modifying it, violating the stated aspect invariant |
| 7 | MINOR | logic.md (isParent) | Uses object reference equality (`===`) not ID equality; graph doesn't capture this nuance |
| 8 | MINOR | flow description + pubsub aspect | `sortTeamCollections` publishes NO PubSub event, contradicting "every mutation publishes an event" |
| 9 | MINOR | logic.md | `sortTeamCollections` algorithm is undocumented in the graph |
