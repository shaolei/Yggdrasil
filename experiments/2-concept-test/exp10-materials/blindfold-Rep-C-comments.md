# Blindfold Test — Representation C: Commented Source Code

## Q1: Delete with Reindexing

**Delete collection C from a sibling set [A(1), B(2), C(3), D(4), E(5)] — what happens to D and E's orderIndex?**

D's orderIndex changes from 4 to 3, and E's orderIndex changes from 5 to 4. The resulting set is [A(1), B(2), D(3), E(4)].

This is handled by the `deleteCollection` method (lines 741-762) and `deleteCollectionAndUpdateSiblingsOrderIndex` (lines 666-731). When `deleteCollection` is called for C:

1. It fetches C and finds C's orderIndex is 3.
2. It calls `deleteCollectionAndUpdateSiblingsOrderIndex` with `orderIndexCondition: { gt: 3 }` and `dataCondition: { decrement: 1 }` (line 750-751).
3. Inside a transaction with pessimistic locking (line 677-681), the method:
   - Deletes C from the database (line 684-686).
   - Runs `updateMany` on all siblings where `orderIndex > 3` (i.e., D at 4 and E at 5), decrementing each by 1 (lines 693-700).
4. After the transaction succeeds, it publishes a `coll_removed` PubSub event (lines 756-759).

The comment at line 688-691 explicitly states: "INVARIANT: Maintain orderIndex contiguity — fill the gap left by deletion." This preserves the contiguous 1..N sequence documented in the file header (line 62): "OrderIndex contiguity: within (teamID, parentID), always 1..N with no gaps."

The delete operation also has a retry loop (the only method with one, per ADR-005 at line 640) to handle deadlocks when two concurrent deletes target overlapping sibling ranges. Retry conditions include UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, and TRANSACTION_TIMEOUT, with linear backoff at `retryCount * 100ms` (lines 716-726).

## Q2: Cycle Detection

**Move B into D in the tree A -> B -> C -> D — is it allowed? Why or why not?**

No, this move is rejected. The system returns `TEAM_COLL_IS_PARENT_COLL` (line 952).

The `moveCollection` method (line 893) calls `isParent` (lines 836-877) to check whether the source collection (B) is an ancestor of the destination collection (D). The `isParent` method uses a walk-up algorithm (ADR-004, line 819-824): it starts at the destination (D) and walks up the tree following parentID links, checking if any ancestor is the source (B).

The algorithm for this specific case (also documented in the inline example at lines 848-853):

1. Start at D. D's parentID is C. Is C === B? No. Recurse with C.
2. At C. C's parentID is B. Is B === B? Yes! Return `O.none` (line 862), meaning "cycle detected."

Back in `moveCollection`, when `isParent` returns `O.none` (line 951), the method returns `E.left(TEAM_COLL_IS_PARENT_COLL)` (line 952), rejecting the move.

The design decision comment (lines 819-825) explains why walk-up was chosen over walk-down: walking up follows a single chain of parentID pointers at O(depth) complexity, whereas walking down from A through all descendants would require loading the entire subtree at O(subtree_size) complexity.

The algorithm's return values are (lines 832-834):
- `O.none` = invalid (would create a cycle)
- `O.some(true)` = valid (safe to move)

## Q3: Concurrent Deletes

**Two users simultaneously delete different collections from the same parent — what happens?**

The system handles this through two mechanisms: pessimistic locking and a retry loop with linear backoff.

**Pessimistic locking** (lines 676-681): Each delete operation acquires a row lock scoped to `(teamID, parentID)` via `lockTeamCollectionByTeamAndParent()`. This means if User 1 starts deleting collection X and User 2 simultaneously starts deleting collection Y (both under the same parent), one transaction will acquire the lock first and the other will block until the first completes. The lock scope is specifically `(teamID, parentID)` so that deletes in different subtrees do not block each other (line 33 of the header comment).

**Retry loop** (lines 671-728): The `deleteCollectionAndUpdateSiblingsOrderIndex` method is the ONLY method with a retry loop (as noted at line 640 and ADR-005 at line 640). Despite locking, deadlocks can still occur because both transactions each lock, then try to decrement overlapping ranges. When lock acquisition order differs, deadlocks happen (lines 648-651).

The retry loop handles three transient error conditions (lines 716-720):
- `UNIQUE_CONSTRAINT_VIOLATION`: two operations assigned the same orderIndex
- `TRANSACTION_DEADLOCK`: two transactions locked rows in conflicting order
- `TRANSACTION_TIMEOUT`: lock wait exceeded timeout

The backoff strategy is linear at `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms), with a maximum of 5 retries and maximum total wait of 1.5 seconds (lines 134-138, 724-725). Linear backoff was chosen over exponential because the lock contention window is short (line 137).

Additionally, the delete method includes a guard against concurrent deletion (line 692): "If it was already deleted by a concurrent transaction (race condition), skip reindexing to avoid corrupting the sibling order." If the `deletedCollection` result is falsy (already deleted by another transaction), the reindexing step is skipped.

## Q4: Integer vs Fractional orderIndex

**Why integer orderIndex instead of fractional? Argue FOR the current design.**

The source code provides several explicit arguments for integer orderIndex (ADR-002, lines 35-38 and line 424-426):

**1. Simplicity for a real-time collaborative tool (line 38):** The header comment states: "For a real-time collaborative tool, integer ordering is simpler to reason about." With integers, the invariant is clear and verifiable: within any `(teamID, parentID)` sibling set, orderIndex values are always contiguous from 1 to N with no gaps (line 62). This makes debugging and data inspection straightforward.

**2. No rebalancing needed:** Fractional ordering "eventually needs rebalancing when precision is exhausted" (line 37). With floating-point fractions, repeated insertions between two adjacent items progressively halve the available precision. Eventually, the system needs a full rebalancing pass (renumbering all siblings). Integer ordering avoids this entirely because every mutation already maintains the contiguous 1..N invariant.

**3. Reliable cursor-based pagination (lines 424-426):** The `getChildrenOfCollection` method uses cursor-based pagination ordered by orderIndex. The comment explicitly notes: "The contiguous integer orderIndex invariant (ADR-002) is critical here — it ensures cursor-based pagination is reliable and predictable. With fractional ordering, cursor-based pagination would be fragile." Contiguous integers guarantee stable, predictable page boundaries.

**4. Straightforward range-shift operations (lines 40-41):** The reorder algorithm uses range-shift (ADR-007): moving an item shifts a range of siblings up or down by 1. With integers, this is a simple `increment`/`decrement` 1 on a bounded range. With fractional ordering, you would need to compute new fractional values for inserted items, which is more complex.

**5. Deterministic duplicate placement:** During import and duplication (lines 317, 583-590), new items get `lastIndex + 1`. This is trivial with integers. With fractional ordering, you would need to compute a fraction greater than the last item.

**6. Locking makes the integer approach viable:** The primary downside of integer ordering is that mutations must touch multiple sibling rows. But the system already uses pessimistic locking (ADR-001, lines 28-33), which serializes access to a sibling set. Since locking is already present, the cost of touching multiple rows is acceptable and the main advantage of fractional ordering (avoiding touching siblings) is neutralized.

## Q5: Duplication Process

**Duplicate a 3-level deep collection — describe the process.**

The `duplicateTeamCollection` method (lines 1636-1661) uses an export-then-import pipeline (ADR-003). For a 3-level collection (e.g., Root -> Child -> Grandchild), the process is:

**Step 1 — Fetch the source collection** (line 1637-1638): Call `getCollection(collectionID)` to retrieve the collection record. If not found, return `TEAM_INVALID_COLL_ID`.

**Step 2 — Export the entire subtree to JSON** (lines 1641-1645): Call `exportCollectionToJSONObject(teamID, collectionID)`. This method (lines 194-248) recursively walks the tree depth-first:
- Fetch the root collection
- Find all children of root (ordered by orderIndex ascending, line 209)
- For each child, recursively call `exportCollectionToJSONObject` again (line 214)
  - This fetches the child's children (grandchildren), and so on recursively
- At each level, also fetch all requests in the collection (ordered by orderIndex, line 226)
- Build a `CollectionFolder` object with `name`, `folders` (children), `requests`, and `data`

For a 3-level tree, this produces a nested JSON structure like:
```
{ name: "Root", folders: [{ name: "Child", folders: [{ name: "Grandchild", folders: [], requests: [...] }], requests: [...] }], requests: [...] }
```

**Step 3 — Modify the title** (lines 1648-1654): The exported JSON is wrapped in an array with the root's title changed to `"${originalTitle} - Duplicate"` (line 1653).

**Step 4 — Re-import** (lines 1648-1658): Call `importCollectionsFromJSON` with the modified JSON, the same `teamID`, and the same `parentID` as the original. The import method (lines 289-366):
- Parses the JSON string
- Opens a transaction with pessimistic locking on the parent's sibling set (lines 307-314)
- Reads the last orderIndex under the parent (line 318-323)
- Calls `generatePrismaQueryObjForFBCollFolder` for each top-level item (lines 326-332), which recursively builds nested Prisma create queries. At each level, children get orderIndex 1, 2, 3... within their own sibling set (line 179). Requests also get 1-based contiguous orderIndex (line 171).
- Creates all collections via `Promise.all` (line 342), which materializes the entire tree structure with new IDs in a single transaction.
- After the transaction commits, publishes `coll_added` PubSub events for each top-level imported collection (lines 358-363).

The duplicate ends up placed in the same parent as the original, at the end of the sibling set (since import appends at `lastOrderIndex + 1`). The comment at line 1633-1634 confirms: "The duplicate is placed in the SAME parent as the original, at the end of the sibling set (import always appends)."

## Q6: Adding Alphabetical Sort Feature

**If we add a "sort collections alphabetically" feature, which existing constraints and patterns apply?**

This feature essentially already exists! The `sortTeamCollections` method (lines 1673-1721) supports `SortOptions.TITLE_ASC` and `SortOptions.TITLE_DESC` (lines 1680-1683). The existing implementation reveals which constraints and patterns apply:

**1. Pessimistic Locking (pattern):** The sort method acquires a lock via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` (lines 1690-1695) before reading and reassigning orderIndex values. Any alphabetical sort feature must do the same to prevent concurrent operations from corrupting the ordering.

**2. OrderIndex Contiguity Invariant:** After sorting, orderIndex values are reassigned as contiguous 1..N based on the sorted order (lines 1703-1710): `collections.map((collection, i) => tx.teamCollection.update({ ... data: { orderIndex: i + 1 } }))`. The invariant "within (teamID, parentID), always 1..N with no gaps" (line 62) must be maintained.

**3. Transaction boundary:** The entire sort must happen within a single `$transaction` (line 1689) to ensure atomicity. If the reassignment partially fails, the whole operation rolls back.

**4. Scope limitation to one parent:** Sort operates on siblings under a single `(teamID, parentID)` pair. It does not recursively sort descendants. This is consistent with the lock scope design (line 33).

**5. PubSub gap (noted issue):** The existing sort method does NOT emit a PubSub event (line 1670-1671): "NOTE: No PubSub event is emitted for sort. This may be a gap — connected clients won't see the reorder in real-time unless they refresh." A new sort feature should consider whether to add a `coll_order_updated` event to fix this gap.

**6. Same-team constraint:** The sort method accepts `teamID` as a parameter and filters by it. Cross-team operations are inherently prevented by the query scope.

**7. Error handling pattern:** On failure, the sort returns `E.left(TEAM_COL_REORDERING_FAILED)` (line 1717), consistent with other reorder operations. The fp-ts Either pattern applies.

**8. No retry loop needed:** Unlike delete (which has a retry loop), sort does not race with overlapping range decrements. The pessimistic lock is sufficient (only delete has the retry loop, per ADR-005 at line 49-51).

## Q7: Replacing PubSub with a Message Queue

**If PubSub is replaced with a message queue, what changes in this module?**

Based on the source code, the following changes would be needed:

**1. Constructor injection (line 124-128):** The `PubSubService` dependency injected via the constructor would need to be replaced with a message queue client. The constructor currently is:
```typescript
constructor(
    private readonly prisma: PrismaService,
    private readonly pubsub: PubSubService,
    private readonly teamService: TeamService,
) {}
```
The `pubsub` parameter would become a message queue service.

**2. All `this.pubsub.publish()` calls** would change to message queue enqueue calls. These occur in the following locations:
- **`importCollectionsFromJSON`** (lines 358-363): publishes `team_coll/${teamID}/coll_added` for each imported top-level collection
- **`createCollection`** (lines 603-606): publishes `team_coll/${teamID}/coll_added`
- **`renameCollection`** (lines 626-629): publishes `team_coll/${teamID}/coll_updated`
- **`deleteCollection`** (lines 756-759): publishes `team_coll/${teamID}/coll_removed` with just the collection ID
- **`moveCollection`** (lines 923-926 and 969-973): publishes `team_coll/${teamID}/coll_moved`
- **`updateCollectionOrder`** (lines 1093-1099 and 1182-1188): publishes `team_coll/${teamID}/coll_order_updated` with `{ collection, nextCollection }`
- **`updateTeamCollection`** (lines 1253-1256): publishes `team_coll/${teamID}/coll_updated`

**3. The "PubSub AFTER COMMIT" pattern must be preserved or adapted:** The current design (ADR-007, line 53-54) places all publish calls AFTER the transaction block completes successfully: "Prevents phantom events where clients see updates for rolled-back transactions." With a message queue, you have two options:
- **Keep the same pattern:** Enqueue after the transaction commits (current behavior, simple).
- **Use transactional outbox:** Write events to an outbox table within the transaction, then have a separate process drain the outbox to the message queue. This provides stronger delivery guarantees.

**4. Channel naming convention:** The current channels follow the pattern `team_coll/${teamID}/<event_type>` (line 59). These would become topic/queue names in the message queue system. The channel structure may need adaptation depending on the queue's topic model.

**5. Payload format differences:** Different events have different payloads — `coll_removed` sends just the ID string (line 758), while other events send the full `TeamCollection` object via `this.cast()`. A message queue might require standardized envelope formats.

**6. The `sortTeamCollections` method has no PubSub event** (noted at line 1670-1671 as a possible gap). This gap would carry over to the message queue implementation unless explicitly addressed.

**7. Import statement change (line 95):** `import { PubSubService } from '../pubsub/pubsub.service'` would change to import the message queue service.

## Q8: Removing Locking from Reorder

**A junior developer removes locking from reorder because "it's slow" — what breaks?**

Removing pessimistic locking from `updateCollectionOrder` (lines 1027-1194) would cause several serious concurrency failures:

**1. Race condition on orderIndex reads (lines 1051-1057, 1125-1133):** The reorder method re-reads orderIndex values inside the transaction AFTER acquiring the lock. The comment at lines 1020-1022 explicitly states: "Both paths re-read orderIndex values INSIDE the transaction after acquiring the lock. This guards against race conditions where the orderIndex changed between the initial read (outside the transaction) and lock acquisition." Without the lock, two concurrent reorder operations could both read the same orderIndex values, compute shifts based on stale data, and overwrite each other's changes.

**2. Broken contiguity invariant:** The orderIndex contiguity invariant (1..N with no gaps, line 62) would be violated. Consider two concurrent reorders on siblings [A(1), B(2), C(3), D(4)]:
- User 1 moves A to end: reads A's index as 1, decrements B,C,D, sets A to 4
- User 2 moves D before B: reads D's index as 4, shifts B,C up, sets D to 2
- Without locking, both execute simultaneously with stale reads. The resulting orderIndex values could have duplicates or gaps, e.g., two items at index 2 or a gap at index 3.

**3. `updateMany` on overlapping ranges would corrupt data:** The range-shift algorithm (ADR-007, lines 1000-1018) uses `updateMany` to increment or decrement a range of siblings. Without locking, two concurrent range-shifts on overlapping ranges would double-increment or double-decrement some items. For example, if both operations try to decrement range [3,4], an item at index 4 would be decremented twice to 2 instead of once to 3.

**4. "Move to end" case would assign wrong position (lines 1075-1085):** The "move to end" logic calls `getCollectionCount` to determine the end position. Without locking, a concurrent create or delete could change the count between the decrement step and the count step, causing the item to be placed at the wrong position.

**5. The header comment explicitly warns about this (lines 28-33):** "Every operation that reads and then modifies sibling orderIndex values acquires a row lock first via lockTeamCollectionByTeamAndParent(). Optimistic locking (version columns + retry on conflict) was rejected because reorder operations touch MANY siblings via updateMany — a single conflicting row would invalidate the entire batch."

**6. No retry loop to save you:** Unlike delete (which has a retry loop for deadlocks), `updateCollectionOrder` does NOT have a retry loop. It relies entirely on the lock to serialize access. Without the lock, there is no fallback mechanism — failures would surface as silent data corruption rather than transient errors.

**7. PubSub events would report stale data:** The PubSub events (lines 1093-1099, 1182-1188) are emitted based on the original collection read (outside the transaction). Without locking, the actual orderIndex in the database may differ from what was published, causing connected clients to display incorrect ordering.

In summary, removing locking would break the core contiguity invariant, cause silent data corruption under concurrency, and make the system's ordering unreliable for all connected clients.
