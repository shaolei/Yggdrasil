# M3 Drift Recovery Report

## Drift Type

**Source drift** -- source code has changed since the graph was last synced; the graph (context package) is stale.

---

## Summary of Changes in Current Code vs. Graph

The M3 mutation removes the **retry-on-deadlock** pattern from `deleteCollectionAndUpdateSiblingsOrderIndex` and also removes the **pessimistic locking** from that same method. Additionally, the `sortTeamCollections` method has been added (new functionality not captured in the graph). Several smaller behavioral changes are present. Below is the complete enumeration.

---

## 1. Artifact: `constraints.md`

### Change: No constraint changes detected

The constraints documented in the graph (circular reference prevention, orderIndex contiguity, same-team constraint, self-move prevention, already-root guard, title minimum length, data field validation) are all still enforced in the current code. No constraint violations.

**Status:** No update needed.

---

## 2. Artifact: `decisions.md`

### Change D1: "Why delete has retries but other mutations do not" -- decision is now STALE

**BEFORE (graph):**
> Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs. The retry loop handles these transient deadlocks. Create and move operations are less prone to this because they typically modify non-overlapping index ranges (append at end, or shift in one direction).

**AFTER (code):**
The `deleteCollectionAndUpdateSiblingsOrderIndex` method (lines 555-589) no longer has any retry loop. It is a single `prisma.$transaction` call with no retry/backoff logic. The method simply:
1. Opens a transaction
2. Deletes the collection
3. Updates sibling orderIndexes
4. If exception: logs and returns `E.left(TEAM_COL_REORDERING_FAILED)`

There is no `MAX_RETRIES` usage, no `delay()` call, no error-code checking for `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, or `TRANSACTION_TIMEOUT` within this method.

**Required update:** This decision should be either removed or rewritten to explain why the retry loop was removed. The current decision text is factually incorrect about the code's behavior.

---

### Change D2: No new decision for `sortTeamCollections`

**BEFORE (graph):** No mention of sorting.

**AFTER (code):** `sortTeamCollections` (lines 1476-1523) is a new public method that sorts collections under a parent by title (ascending or descending) or by existing orderIndex. It uses pessimistic locking and reassigns orderIndex values 1..N based on the sorted order.

**Required update:** Consider adding a decision explaining the sort approach (re-assign all orderIndexes within a locked transaction rather than, e.g., using database-level ORDER BY permanently).

---

## 3. Artifact: `logic.md`

### Change L1: Delete algorithm simplified

**BEFORE (graph):**
The graph does not describe the internal delete algorithm in `logic.md` -- it only references delete behavior in `constraints.md` (orderIndex contiguity) and `decisions.md` (retry rationale). However, the retry-on-deadlock aspect describes the delete algorithm as having a retry loop with linear backoff.

**AFTER (code):**
`deleteCollectionAndUpdateSiblingsOrderIndex` (lines 555-589) is now a simple single-attempt transaction:
```typescript
async deleteCollectionAndUpdateSiblingsOrderIndex(...) {
  try {
    await this.prisma.$transaction(async (tx) => {
      const deletedCollection = await tx.teamCollection.delete({ where: { id: collection.id } });
      if (deletedCollection) {
        await tx.teamCollection.updateMany({
          where: { teamID, parentID, orderIndex: orderIndexCondition },
          data: { orderIndex: dataCondition },
        });
      }
    });
  } catch (error) {
    console.error(...);
    return E.left(TEAM_COL_REORDERING_FAILED);
  }
  return E.right(true);
}
```

No retry loop, no delay, no error-code inspection.

**Required update:** `logic.md` does not need a change for this (it did not previously describe the delete internals), but the aspect `retry-on-deadlock` needs major revision (see below).

---

### Change L2: Delete no longer uses pessimistic locking

**BEFORE (graph/aspect):**
The pessimistic-locking aspect states: "Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first." The delete operation was understood to follow this pattern.

**AFTER (code):**
`deleteCollectionAndUpdateSiblingsOrderIndex` does NOT call `lockTeamCollectionByTeamAndParent`. It goes straight into `tx.teamCollection.delete()` followed by `tx.teamCollection.updateMany()` without acquiring the sibling lock.

This is notable because other methods that modify orderIndex DO still lock:
- `createCollection` (line 479): locks
- `importCollectionsFromJSON` (line 219): locks
- `updateCollectionOrder` -- both branches (lines 854, 926): locks
- `moveCollection` via `changeParentAndUpdateOrderIndex` (lines 727, 784): locks
- `sortTeamCollections` (line 1493): locks

**Required update:** This is an **aspect violation** (see below).

---

### Change L3: New sort algorithm

**BEFORE (graph):** Not present.

**AFTER (code):** `sortTeamCollections` (lines 1476-1523):
1. Lock siblings via `lockTeamCollectionByTeamAndParent`
2. Fetch all collections under `(teamID, parentID)` ordered by sort criteria
3. Reassign `orderIndex = i + 1` for each collection in sorted order
4. All within a single transaction

**Required update:** Add sort algorithm to `logic.md`.

---

## 4. Artifact: `responsibility.md`

### Change R1: Missing "Sort" in scope

**BEFORE (graph):**
> - Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings

Actually, "sort siblings" IS mentioned in the graph's responsibility. However, it is listed under the parent hierarchy node, not in the own-artifacts responsibility. Let me check more carefully...

The own-artifacts `responsibility.md` says:
> - Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings

So sort IS mentioned. Good -- the graph anticipated this. No update needed for the responsibility description itself.

### Change R2: Missing sort from CLI support mention

The current code includes `sortTeamCollections` as a public method but it is not listed under CLI support. This is minor as it may be called from resolvers rather than CLI.

**Status:** Minor update -- consider mentioning sort in the responsibility list if it is a first-class operation.

---

## 5. Artifact: `node.yaml` (aspects list)

### Change N1: `retry-on-deadlock` aspect is no longer applicable

**BEFORE (graph):**
```yaml
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]
```

**AFTER (code):**
The `MAX_RETRIES = 5` constant still exists in the class (line 60), but it is **never used** anywhere in the code. There is no retry loop in any method. The `delay` import exists (line 26) but is also never called in any method of this service.

The `retry-on-deadlock` aspect described:
- Maximum retries: 5
- Linear backoff: `retryCount * 100ms`
- Retry conditions: `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, `TRANSACTION_TIMEOUT`
- Scope: `deleteCollectionAndUpdateSiblingsOrderIndex`

None of this behavior exists in the current code.

**Required update:**
```yaml
# BEFORE
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]

# AFTER
aspects: [pessimistic-locking, pubsub-events]
```

The `retry-on-deadlock` aspect should be removed from this node. If this is the only node using the aspect, the aspect itself may be a candidate for removal from the graph entirely.

---

## 6. Aspect: `pessimistic-locking`

### ASPECT VIOLATION DETECTED

**Aspect rule (from graph):**
> "Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first."

**Violation in code:**
`deleteCollectionAndUpdateSiblingsOrderIndex` (lines 555-589) modifies sibling orderIndex values (`updateMany` with `orderIndexCondition` and `dataCondition`) but does NOT call `lockTeamCollectionByTeamAndParent` before doing so.

**Methods that DO comply:**
| Method | Locks? | Modifies orderIndex? |
|---|---|---|
| `createCollection` | Yes (line 479) | Yes (assigns new orderIndex) |
| `importCollectionsFromJSON` | Yes (line 219) | Yes (assigns new orderIndex) |
| `updateCollectionOrder` (null branch) | Yes (line 854) | Yes (shifts siblings) |
| `updateCollectionOrder` (non-null branch) | Yes (line 926) | Yes (shifts siblings) |
| `moveCollection` / `changeParentAndUpdateOrderIndex` | Yes (lines 727, 784) | Yes (decrements old siblings, appends to new parent) |
| `sortTeamCollections` | Yes (line 1493) | Yes (reassigns all orderIndexes) |
| `deleteCollectionAndUpdateSiblingsOrderIndex` | **NO** | **YES** |

**Severity:** HIGH. The delete method is the one most prone to concurrency issues (as the original `retry-on-deadlock` decision explicitly stated), and it is now the only orderIndex-mutating method that operates without a pessimistic lock. This removes both safety nets (locking AND retries) from the most race-prone operation.

**Required action:** Either:
1. Add `lockTeamCollectionByTeamAndParent` to `deleteCollectionAndUpdateSiblingsOrderIndex`, OR
2. Document an explicit exemption with rationale in the aspect

---

## 7. Aspect: `pubsub-events`

### No violations detected

All mutation methods in the current code still publish PubSub events after their database operations:

| Method | Event | Compliant? |
|---|---|---|
| `createCollection` | `coll_added` | Yes |
| `importCollectionsFromJSON` | `coll_added` (per collection) | Yes |
| `renameCollection` | `coll_updated` | Yes |
| `updateTeamCollection` | `coll_updated` | Yes |
| `deleteCollection` | `coll_removed` | Yes |
| `moveCollection` | `coll_moved` | Yes |
| `updateCollectionOrder` | `coll_order_updated` | Yes |
| `duplicateTeamCollection` | via `importCollectionsFromJSON` | Yes |
| `sortTeamCollections` | **NONE** | **POTENTIAL VIOLATION** |

### POTENTIAL ASPECT VIOLATION: `sortTeamCollections` has no PubSub event

**Aspect rule (from graph):**
> "Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates."

**Code behavior:**
`sortTeamCollections` (lines 1476-1523) mutates the `orderIndex` of potentially every collection under a parent but publishes NO PubSub event afterward. Connected clients will not receive real-time updates about the reorder.

**Severity:** MEDIUM. Sorting changes the order of all siblings, which affects the UI. Without a PubSub event, clients with open subscriptions will show stale ordering until they manually refresh.

**Required action:** Either:
1. Publish a `coll_order_updated` event (or a batch equivalent) after sort completes, OR
2. Document an explicit exemption explaining why sort does not need real-time propagation

---

## 8. Aspect: `retry-on-deadlock`

### Aspect is ENTIRELY INAPPLICABLE to current code

**BEFORE (graph):**
The aspect describes a retry loop with:
- 5 max retries
- Linear backoff (100ms increments)
- Error code filtering (UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT)
- Applied to `deleteCollectionAndUpdateSiblingsOrderIndex`

**AFTER (code):**
- `MAX_RETRIES = 5` exists as a dead constant (never referenced)
- `delay` is imported but never called
- `PrismaError` is imported but never used for retry logic
- No retry loop exists anywhere in the service

**Required action:**
1. Remove `retry-on-deadlock` from this node's aspects list
2. If no other nodes use this aspect, consider archiving or deleting the aspect directory

---

## Consolidated Change Summary

| # | Change | Artifact | Severity | Action |
|---|---|---|---|---|
| 1 | Retry loop removed from delete | `decisions.md` | HIGH | Remove or rewrite decision "Why delete has retries" |
| 2 | Delete no longer locks siblings | `decisions.md`, aspect | HIGH | **Aspect violation** -- fix code or document exemption |
| 3 | `retry-on-deadlock` aspect no longer applies | `node.yaml` | HIGH | Remove aspect from node |
| 4 | New `sortTeamCollections` method | `logic.md`, `responsibility.md` | MEDIUM | Add sort algorithm to logic, verify responsibility coverage |
| 5 | Sort has no PubSub event | aspect `pubsub-events` | MEDIUM | **Potential aspect violation** -- add event or document exemption |
| 6 | Dead code: `MAX_RETRIES`, `delay` import, `PrismaError` import | n/a (code quality) | LOW | Clean up unused imports/constants |

---

## Recommended Graph Updates (BEFORE / AFTER)

### `node.yaml`

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
aspects: [pessimistic-locking, pubsub-events]

relations: []

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-collection/team-collection.service.ts
```

### `decisions.md`

**BEFORE:**
```markdown
## Why delete has retries but other mutations do not

Delete+reindex can race with other deletes on the same sibling set. Two concurrent
deletes each start a transaction, lock, then try to decrement overlapping ranges.
The pessimistic lock prevents data corruption but can cause deadlocks when lock
acquisition order differs. The retry loop handles these transient deadlocks. Create
and move operations are less prone to this because they typically modify
non-overlapping index ranges (append at end, or shift in one direction).
```

**AFTER:**
```markdown
## [REMOVED] Why delete has retries but other mutations do not

This decision is no longer applicable. The retry loop has been removed from
deleteCollectionAndUpdateSiblingsOrderIndex. The method now executes a single
transaction attempt without retries or backoff. Rationale for removal: UNKNOWN
(requires developer input).

NOTE: The delete method also no longer acquires a pessimistic lock, unlike all
other orderIndex-mutating methods. This may be intentional or an oversight --
requires clarification.
```

### `logic.md`

**BEFORE:** (no sort algorithm)

**AFTER:** (append)
```markdown
## Sort siblings (sortTeamCollections)

1. Lock siblings via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`
2. Fetch all collections under `(teamID, parentID)` ordered by sort criteria:
   - `TITLE_ASC`: `{ title: 'asc' }`
   - `TITLE_DESC`: `{ title: 'desc' }`
   - default: `{ orderIndex: 'asc' }` (no-op re-index)
3. For each collection at position `i`, set `orderIndex = i + 1`
4. All updates executed via `Promise.all` within the transaction

This reassigns contiguous 1-based orderIndexes according to the chosen sort order.
```

### `responsibility.md`

**BEFORE:**
```markdown
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
```

**AFTER:** (no change needed -- sort was already listed)

---

## Aspect Violations Summary

| Aspect | Violation | Severity | Details |
|---|---|---|---|
| `pessimistic-locking` | `deleteCollectionAndUpdateSiblingsOrderIndex` modifies orderIndex without acquiring row lock | **HIGH** | Only orderIndex-mutating method without locking. Both safety nets (lock + retry) removed simultaneously. |
| `pubsub-events` | `sortTeamCollections` mutates orderIndex of all siblings but publishes no PubSub event | **MEDIUM** | Connected clients will not see sort results in real time. |
| `retry-on-deadlock` | Entire aspect is inapplicable -- no retry logic exists in code | **HIGH** (staleness) | Dead aspect reference. Not a violation per se but a graph accuracy issue. |
