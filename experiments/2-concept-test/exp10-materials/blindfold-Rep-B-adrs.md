# Blindfold Test — Representation B: Architecture Decision Records

## Q1: Delete with Reindexing

**Delete collection C from a sibling set [A(1), B(2), C(3), D(4), E(5)] — what happens to D and E's orderIndex?**

When C (orderIndex 3) is deleted, the system decrements the orderIndex of all siblings with an orderIndex greater than the deleted item's. This means:

- D's orderIndex changes from 4 to 3
- E's orderIndex changes from 5 to 4

The resulting sibling set becomes: A(1), B(2), D(3), E(4). This maintains the contiguity invariant described in ADR-002, which states that within a sibling set, orderIndex values must be contiguous starting from 1, and every delete decrements all higher siblings. The entire operation runs inside a transaction with a pessimistic lock on the sibling set (ADR-001), and if a deadlock occurs during this delete+reindex operation, the retry logic from ADR-005 will handle it (up to 5 retries with linear backoff).

**Sources:** ADR-002 (integer orderIndex contiguity invariant, delete rule), ADR-001 (pessimistic locking during mutation), ADR-005 (retry logic specifically for delete operations).

## Q2: Cycle Detection

**Move B into D in the tree A -> B -> C -> D — is it allowed? Why or why not?**

No, this move is not allowed. The system uses the `isParent` method described in ADR-004 to detect cycles. The algorithm walks UP from the destination (D) to the root, following parentID links, checking at each step whether the current node is the source (B).

The walk proceeds as follows:

1. Start at destination D. Is D the source B? No.
2. D's parent is C. Is C the source B? No.
3. C's parent is B. Is B the source B? Yes — the source is found as an ancestor of the destination.

Since B is encountered while walking up from D, the move would create a circular reference (B would be both an ancestor and a descendant of D). The move is rejected with the error `TEAM_COLL_IS_PARENT_COLL`.

This walk-up approach was chosen over walking down (ADR-004) because it is O(depth) — following a single chain of parent pointers — rather than O(subtree_size), which would require loading B's entire subtree to check if D is among its descendants.

**Sources:** ADR-004 (walk-up cycle detection algorithm), Module Overview constraints (circular reference prevention).

## Q3: Concurrent Deletes

**Two users simultaneously delete different collections from the same parent — what happens?**

Both delete operations target the same parent's sibling set, so they contend for the same pessimistic lock. Per ADR-001, each delete operation opens a `prisma.$transaction` and calls `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` to lock all sibling rows under that parent.

Two scenarios can unfold:

1. **Serialized execution (typical case):** One transaction acquires the lock first. The second transaction blocks until the first commits. After the first delete completes and reindexes, the second transaction acquires the lock, reads the now-updated orderIndex values, and performs its own delete + reindex correctly. The contiguity invariant is preserved because each operation sees a consistent state.

2. **Deadlock (possible case):** If the two transactions acquire locks in a conflicting order (e.g., each locks some rows before the other), a deadlock can occur. ADR-005 specifically addresses this: the `deleteCollectionAndUpdateSiblingsOrderIndex` method has a retry loop with a maximum of 5 retries, linear backoff (100ms, 200ms, 300ms, 400ms, 500ms), and retries on `TRANSACTION_DEADLOCK`, `UNIQUE_CONSTRAINT_VIOLATION`, and `TRANSACTION_TIMEOUT` Prisma error codes. The deadlocked transaction will be rolled back by the database and retried. After retry, it re-acquires the lock and operates on the current state.

After both operations complete, each publishes a `coll_removed` PubSub event (ADR-006), so connected clients receive both removal notifications.

**Sources:** ADR-001 (pessimistic locking scoped to parent), ADR-005 (retry logic for delete deadlocks, specific error codes and backoff), ADR-006 (PubSub after commit).

## Q4: Integer vs Fractional orderIndex

**Why integer orderIndex instead of fractional? Argue FOR the current design.**

ADR-002 provides the rationale. The arguments in favor of integer orderIndex are:

1. **Predictability and contiguity:** Integer indexes always form a clean 1..N sequence within a sibling set. The UI can trust that indexes are contiguous — there are no gaps, no floating-point precision artifacts, and no need for normalization passes. This enables reliable cursor-based pagination and consistent UI rendering.

2. **Simplicity of reasoning:** Integers are trivial to reason about. There is no precision exhaustion problem. Fractional ordering eventually requires a rebalancing pass when you run out of space between two values (e.g., trying to insert between 1.0000001 and 1.0000002). Integer ordering never has this problem because it simply maintains contiguity through range shifts.

3. **No rebalancing needed:** Fractional schemes require periodic rebalancing to redistribute values when precision is exhausted. This adds algorithmic complexity and introduces a non-deterministic maintenance operation. Integer ordering avoids this entirely.

4. **Consistency over throughput:** Hoppscotch is a real-time collaborative tool where consistency matters more than write throughput. The write amplification of touching multiple sibling rows during delete/reorder is an acceptable trade-off for the guarantee that indexes are always clean and predictable. The pessimistic locking (ADR-001) that integer ordering requires is already necessary for a collaborative environment anyway.

5. **Bounded write amplification:** The range-shift algorithm (ADR-007) only touches the affected range of siblings, not all siblings. For most operations (small reorders, deletes), the number of affected rows is modest.

The negative trade-off — that every delete, reorder, and move must touch multiple sibling rows — is manageable given that sibling sets are typically not enormous, and the lock scope (ADR-001) is narrow (per-parent, not per-team).

**Sources:** ADR-002 (integer vs fractional decision and rationale), ADR-007 (range-shift efficiency), ADR-001 (locking as enabling mechanism).

## Q5: Duplication Process

**Duplicate a 3-level deep collection — describe the process.**

ADR-003 describes duplication as an export-then-import pipeline. For a 3-level deep collection (e.g., Root -> Child -> Grandchild, each potentially containing requests), the process is:

**Step 1 — Export:** `exportCollectionToJSONObject(teamID, collectionID)` recursively serializes the entire collection subtree into a `CollectionFolder` JSON structure. This walks the tree depth-first, capturing:
- The root collection (level 1) with its title, data, and requests
- All child collections (level 2) with their titles, data, and requests
- All grandchild collections (level 3) with their titles, data, and requests

The result is a nested JSON object representing the complete 3-level tree.

**Step 2 — Modify title:** The root collection's title in the JSON is modified by appending `" - Duplicate"`. Child and grandchild titles remain unchanged.

**Step 3 — Import:** `importCollectionsFromJSON(jsonString, teamID, parentID)` deserializes the JSON and creates the entire subtree with:
- New IDs for every collection and request (no ID collisions with originals)
- Correct orderIndex values assigned at each level (appended at the end of each sibling set)
- Proper pessimistic locking (ADR-001) during creation to maintain orderIndex integrity
- PubSub events (`coll_added`) published for each created collection after the transaction commits (ADR-006)

The result is a complete, independent copy of the 3-level tree, placed as a sibling of the original (or wherever the parentID specifies), with the root named "Original Title - Duplicate".

The key design insight (ADR-003) is that zero code is duplicated — all the recursive creation logic, ID generation, orderIndex assignment, and locking exists only in the import path, and duplication simply reuses it.

**Sources:** ADR-003 (duplication via export+import pipeline), ADR-001 (locking during import), ADR-006 (PubSub events after creation).

## Q6: Adding Alphabetical Sort Feature

**If we add a "sort collections alphabetically" feature, which existing constraints and patterns apply?**

Based on the ADRs, the following existing constraints and patterns would apply to an alphabetical sort feature:

1. **OrderIndex contiguity invariant (ADR-002):** After sorting, the sibling set must still have contiguous integer orderIndex values starting from 1. The sort operation must reassign orderIndex values to all siblings in alphabetical order, producing a clean 1..N sequence.

2. **Pessimistic locking (ADR-001):** The sort operation reads all siblings' titles and orderIndex values, then writes new orderIndex values to all of them. This is a read-then-write pattern on the entire sibling set. It must acquire the pessimistic lock via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` within a transaction to prevent concurrent mutations from interleaving.

3. **PubSub event emission after commit (ADR-006):** After the sort transaction commits, PubSub events must be published to notify connected clients of the reordering. Following the existing convention, this would likely use the `coll_order_updated` event type on the `team_coll/${teamID}/` channel. Events must be emitted after the transaction commits, not inside it, to avoid phantom events.

4. **Same-team scoping:** The sort operates within a single team's collection tree, scoped to a specific parent. The lock scope is (teamID, parentID), consistent with all other sibling mutations.

5. **Retry consideration (ADR-005):** Since a sort operation touches all siblings (similar in scope to delete+reindex), it could encounter deadlocks if concurrent with other mutations on the same parent. The implementer should consider whether retry logic (similar to ADR-005's pattern) is warranted.

6. **Range-shift pattern familiarity (ADR-007):** While a full sort is more than a range shift, the existing reorder infrastructure demonstrates the pattern of bulk-updating orderIndex values within a locked transaction. The sort is essentially a batch reassignment rather than a shift.

Note: The Module Overview already lists "sort siblings" as an in-scope operation, suggesting this capability exists or was planned. The sort would need to rewrite all orderIndex values for the sibling set in a single transaction.

**Sources:** ADR-001 (pessimistic locking requirement), ADR-002 (contiguity invariant), ADR-005 (retry logic for deadlock-prone operations), ADR-006 (PubSub after commit), ADR-007 (range-shift as prior art for bulk orderIndex updates).

## Q7: Replacing PubSub with a Message Queue

**If PubSub is replaced with a message queue, what changes in this module?**

Based on ADR-006 and the Module Overview, the following would change:

1. **Event emission points stay the same, but the mechanism changes:** Every mutation method currently calls `this.pubsub.publish(channel, payload)` after the transaction commits. These calls would need to be replaced with message queue publish calls. The locations are:
   - `createCollection` — `coll_added`
   - `deleteCollection` — `coll_removed`
   - `moveCollection` — `coll_moved`
   - `updateCollectionOrder` — `coll_order_updated`
   - `renameCollection` / `updateTeamCollection` — `coll_updated`
   - `importCollectionsFromJSON` — `coll_added` for each created collection

2. **Channel naming convention changes:** Currently events use `team_coll/${teamID}/coll_added|coll_updated|coll_removed|coll_moved|coll_order_updated`. A message queue would likely use topics or routing keys instead of PubSub channels. The naming scheme would need to be adapted.

3. **Payload serialization may change:** Current payloads are in-memory objects (full `TeamCollection` for add/update/move, just the ID string for remove, `{collection, nextCollection}` for reorder). A message queue would require explicit serialization (JSON) and potentially a schema/envelope format.

4. **Delivery guarantees improve (potentially):** ADR-006 notes a negative consequence: if PubSub publish fails after commit, clients miss the update because there is no retry or outbox pattern. A message queue with persistence would address this gap, providing at-least-once delivery guarantees.

5. **The "after commit" timing rule (ADR-006) still applies:** The core decision to emit events only after transaction commit remains valid regardless of transport mechanism. You still do not want to enqueue a message inside a transaction that might roll back. However, a message queue opens the door to the transactional outbox pattern (mentioned as a rejected alternative in ADR-006), where events are written to a database table within the transaction and then published asynchronously by a separate process.

6. **PubSubService dependency changes:** The Module Overview states PubSub infrastructure is out of scope (delegated to PubSubService). Replacing it with a message queue would change the injected dependency from `PubSubService` to a message queue client, but the TeamCollectionService's core logic (locking, orderIndex management, cycle detection) would be unaffected.

**What does NOT change:** All database transaction logic, pessimistic locking, orderIndex management, cycle detection, retry logic, and the overall structure of mutation methods remain identical. The change is purely in the event delivery mechanism.

**Sources:** ADR-006 (PubSub event emission timing, channel naming, payload shapes, rejected outbox alternative), Module Overview (PubSub as out-of-scope infrastructure, event types).

## Q8: Removing Locking from Reorder

**A junior developer removes locking from reorder because "it's slow" — what breaks?**

Removing pessimistic locking from the reorder operation would break multiple invariants and create several failure modes:

1. **OrderIndex contiguity invariant violated (ADR-002):** The core invariant is that orderIndex values within a sibling set are contiguous from 1 to N. The reorder operation (ADR-007) reads current orderIndex values, calculates a range shift, and writes new values. Without locking, two concurrent reorders can read the same pre-mutation state and both write shifts based on stale data. The result: duplicate orderIndex values (two items claiming the same position), gaps in the sequence, or both. The UI would display items in wrong or unpredictable order.

2. **Race condition on read-then-write (ADR-001):** ADR-001 explicitly identifies the problem: "Any operation that reads a sibling's orderIndex and then writes a new value based on that read is susceptible to race conditions." The reorder method re-reads orderIndex values inside the transaction specifically to guard against this (ADR-007: "Both paths re-read orderIndex values inside the transaction after acquiring the lock"). Without the lock, this re-read provides no protection because another transaction can modify values between the read and the write.

3. **Range-shift corruption (ADR-007):** The range-shift algorithm increments or decrements all siblings in a range. Two concurrent reorders could shift overlapping ranges simultaneously. For example:
   - User A moves item from position 2 to position 5: decrements positions 3, 4, 5
   - User B simultaneously moves item from position 4 to position 1: increments positions 1, 2, 3
   - Without serialization, both operations apply their shifts to the original values, and the combined result is corrupted — some items get shifted twice, others not at all.

4. **Stale "next collection" reference:** The client specifies a "next collection" to place before. Without locking, that next collection's orderIndex might have changed by the time the write happens, placing the moved item at the wrong position.

5. **PubSub events reflect inconsistent state (ADR-006):** The `coll_order_updated` event is published after the transaction with the resulting state. If the state is corrupted due to a race condition, clients receive and render the corrupted order, propagating the inconsistency to all connected users.

6. **No retry safety net:** ADR-005's retry logic only covers delete operations. Even if retry logic existed for reorder, retrying without locking would just reproduce the same race condition.

The junior developer's concern about performance is addressed by the lock's scope: ADR-001 specifies that the lock is scoped to `(teamID, parentID)` — it only locks siblings under the same parent, not the entire team's collections. Operations on different subtrees proceed in parallel. The serialization cost is limited to concurrent reorders within the exact same sibling set, which is a narrow contention window.

**Sources:** ADR-001 (pessimistic locking rationale, race condition identification, lock scope), ADR-002 (contiguity invariant that breaks without serialization), ADR-007 (range-shift algorithm details, re-read guard inside transaction), ADR-005 (retry only covers deletes), ADR-006 (events reflect committed state).
