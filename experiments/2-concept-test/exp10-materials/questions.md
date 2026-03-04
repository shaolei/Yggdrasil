# Experiment 10 -- Blindfold Questions

These questions test whether an agent can correctly answer implementation and design questions about the TeamCollectionService module using ONLY the provided knowledge representation (no source code access).

## Questions

### Q1: Delete with Reindexing

Delete collection C from a sibling set [A(1), B(2), C(3), D(4), E(5)] -- what happens to D and E's orderIndex?

**Expected answer:** D's orderIndex changes from 4 to 3, and E's orderIndex changes from 5 to 4. The delete operation decrements all siblings with orderIndex > 3 (the deleted item's orderIndex) by 1, maintaining the contiguous 1..N invariant. The resulting sibling set is [A(1), B(2), D(3), E(4)].

---

### Q2: Cycle Detection

Move B into D in the tree A -> B -> C -> D -- is it allowed? Why or why not?

**Expected answer:** It is NOT allowed. The `isParent` method walks UP from D (the destination) toward the root, following parentID links. It checks: D's parent is C, C's parent is B -- and B is the collection being moved. Since the source collection (B) is found on the path from destination (D) to root, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. Moving B into D would create the cycle D -> B -> C -> D. The algorithm is O(depth) because it walks up a single chain of parentID pointers rather than loading the entire subtree.

---

### Q3: Concurrent Deletes

Two users simultaneously delete different collections from the same parent -- what happens?

**Expected answer:** Both operations enter the `deleteCollectionAndUpdateSiblingsOrderIndex` method, which has a retry loop. Each operation starts a `prisma.$transaction` and attempts to acquire a pessimistic lock via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`. Since both target the same parent, they contend for the same lock. One transaction will acquire the lock first and proceed (delete + reindex). The second may encounter a deadlock if lock acquisition order differs, or a unique constraint violation if the concurrent reindex creates conflicting orderIndex values. These transient errors are caught by the retry loop, which waits (linear backoff: retryCount * 100ms) and retries up to 5 times. Eventually both deletes succeed with correct reindexing. Maximum total wait for the retrying operation is 1.5 seconds.

---

### Q4: Integer vs Fractional orderIndex

Why integer orderIndex instead of fractional? Argue FOR the current design.

**Expected answer:** Integer orderIndex with gap-filling guarantees contiguous, predictable indexes (always 1..N with no gaps). This is critical for: (1) reliable cursor-based pagination -- the UI can trust that orderIndex values form a clean sequence, (2) simple reasoning -- no precision exhaustion, no rebalancing passes needed, (3) consistency in a real-time collaborative tool where multiple users modify the same collections. Fractional ordering avoids touching siblings on each mutation but eventually requires a rebalancing pass when floating-point precision is exhausted (e.g., inserting between 1.0000001 and 1.0000002). The write amplification of integer ordering (touching O(distance) siblings per reorder, O(remaining) per delete) is an acceptable trade-off because the pessimistic locking already serializes access to the sibling set, and the lock contention window is short.

---

### Q5: Duplication Process

Duplicate a 3-level deep collection -- describe the process.

**Expected answer:** Duplication uses the export+import pipeline (not a dedicated deep-copy):

1. **Export:** `exportCollectionToJSONObject(teamID, collectionID)` recursively walks the tree depth-first, serializing the root collection, all its children (level 2), and all grandchildren (level 3) into a `CollectionFolder` JSON structure. Each level includes its requests, ordered by orderIndex.

2. **Modify title:** The exported JSON's root name is changed by appending `" - Duplicate"` (e.g., "My Collection" becomes "My Collection - Duplicate").

3. **Import:** `importCollectionsFromJSON(jsonString, teamID, parentID)` deserializes the JSON back into the database. It acquires a pessimistic lock on the parent's sibling set, reads the last orderIndex, then creates the entire subtree with new IDs and correct contiguous orderIndex values. The duplicate is placed at the end of the same parent's sibling set. A `coll_added` PubSub event is emitted after the transaction commits.

This approach reuses the existing recursive import logic (handling nested children, requests, locking, and orderIndex assignment) without duplicating any code. The trade-off is a serialization round-trip but it eliminates a separate code path.

---

### Q6: Adding Alphabetical Sort Feature

If we add a "sort collections alphabetically" feature, which existing constraints and patterns apply?

**Expected answer:** The `sortTeamCollections` method already exists and handles this. The applicable constraints and patterns are:

- **Pessimistic locking:** Must lock the sibling set via `lockTeamCollectionByTeamAndParent` before reading and reassigning orderIndex values, to prevent concurrent mutations from corrupting the order.
- **OrderIndex contiguity invariant:** After sorting, orderIndex values must be reassigned as contiguous 1..N based on the sorted order (the existing implementation does exactly this with `collections.map((c, i) => update(c.id, { orderIndex: i + 1 }))`).
- **Transaction:** The entire sort must happen within a single `prisma.$transaction` to ensure atomicity.
- **Same-team scope:** Sort operates within a single (teamID, parentID) sibling set.
- **PubSub events:** Note that the current `sortTeamCollections` does NOT emit a PubSub event after sorting, which is a known limitation -- connected clients won't see the reorder in real-time. A new sort feature should consider emitting `coll_order_updated` events.

---

### Q7: Replacing PubSub with a Message Queue

If PubSub is replaced with a message queue, what changes in this module?

**Expected answer:** The core timing rule remains the same: events must be emitted AFTER the database transaction commits, not inside it. This prevents phantom events for rolled-back transactions. Specific changes:

1. **All `this.pubsub.publish()` calls** (approximately 8-10 across the module) would need to be replaced with message queue publish calls. These exist in: `createCollection`, `deleteCollection`, `moveCollection` (two paths), `updateCollectionOrder` (two paths), `renameCollection`, `updateTeamCollection`, and `importCollectionsFromJSON`.

2. **Channel names** (`team_coll/${teamID}/coll_added`, etc.) would become queue topic names or routing keys. The naming convention and payload shapes could stay the same.

3. **Payload shapes** remain unchanged: full TeamCollection for add/update/move, ID string for remove, `{collection, nextCollection}` for order updates.

4. **Reliability improvement opportunity:** The current PubSub is fire-and-forget -- if publish fails after commit, clients miss the update. A message queue with persistent delivery could add an outbox pattern (write event to a DB table in the same transaction, then process asynchronously) for guaranteed delivery.

5. **No changes to locking, retry logic, or algorithms** -- those are all database concerns independent of the event delivery mechanism.

---

### Q8: Removing Locking from Reorder

A junior developer removes locking from reorder because "it's slow" -- what breaks?

**Expected answer:** Removing pessimistic locking from reorder operations would break the orderIndex contiguity invariant under concurrent access. Specific failures:

1. **Duplicate orderIndex values:** Two concurrent `createCollection` calls could both read the same `lastOrderIndex` (e.g., 5) and both create a collection at orderIndex 6. The sibling set would have two items at position 6.

2. **Gaps in orderIndex:** Two concurrent `updateCollectionOrder` calls could both read stale positions, shift overlapping ranges, and leave gaps. For example, if items are at [1,2,3,4,5] and two concurrent reorders each shift based on the pre-lock state, the result could be [1,2,4,5,3] or worse.

3. **Lost updates during delete:** Two concurrent deletes could both read orderIndex values, then both decrement overlapping ranges, causing some siblings to be decremented twice (creating gaps or even zero/negative orderIndex values).

4. **Corrupted pagination:** The UI relies on contiguous orderIndex for cursor-based pagination. Gaps or duplicates would cause items to be skipped or shown twice.

5. **Phantom reorder states:** Without locking, the `updateCollectionOrder` method re-reads orderIndex inside the transaction specifically to guard against changes between the initial read and the mutation. Without the lock, even this re-read is unsafe because another transaction could modify the values between the re-read and the subsequent updateMany.

The locking overhead is minimal because it is scoped to `(teamID, parentID)` -- only siblings under the same parent are serialized. Different subtrees can still proceed in parallel.
