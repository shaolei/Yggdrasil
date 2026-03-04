# Blindfold Test — Representation D: Traditional README

## Q1: Delete with Reindexing

**Question:** Delete collection C from a sibling set [A(1), B(2), C(3), D(4), E(5)] -- what happens to D and E's orderIndex?

**Answer:**

According to the "Delete with Reindexing" section under Key Algorithms, the process is:

1. Fetch collection C (orderIndex = 3).
2. Delete collection C (cascading deletes remove any children/requests via DB constraints).
3. Decrement the orderIndex of all siblings with `orderIndex > deleted.orderIndex` (i.e., orderIndex > 3) by 1.

So D's orderIndex changes from 4 to 3, and E's orderIndex changes from 5 to 4. The resulting sibling set is [A(1), B(2), D(3), E(4)].

The README explicitly states: "This maintains the contiguity invariant by filling the gap left by the deletion." The contiguous 1..N invariant is preserved -- there are no gaps and no duplicates.

The operation uses pessimistic locking (described in the "Concurrency Strategy" section): a `lockTeamCollectionByTeamAndParent` call locks the sibling set for the duration of the transaction, preventing concurrent modifications from creating inconsistent orderIndex values. Additionally, the delete operation specifically has a retry loop (up to MAX_RETRIES = 5) to handle transient errors like deadlocks or unique constraint violations, with linear backoff at `retryCount * 100ms`.

**Source:** "Key Algorithms > Delete with Reindexing" section (lines 178-184), "Concurrency Strategy" section (lines 98-121), "Retry Strategy" section (lines 241-255).

---

## Q2: Cycle Detection

**Question:** Move B into D in the tree A -> B -> C -> D -- is it allowed? Why or why not?

**Answer:**

This move is NOT allowed. Moving B into D would create a circular reference: D is a descendant of B, so making B a child of D would form a cycle (D -> B -> C -> D...).

The README describes the cycle detection algorithm in the "Cycle Detection: Walk-Up Algorithm (isParent)" section. The algorithm walks UP from the destination (D) toward the root to check if the source (B) is an ancestor of the destination:

1. Is source (B) === destination (D)? No.
2. Is destination.parentID (D's parent is C) === source.id (B)? No.
3. destination.parentID is not null (C has a parent), so recurse: now checking C.
4. Is C.parentID === source.id (B)? YES -- B is C's parent. This means B is an ancestor of D.

The function returns `O.none`, which means the move is invalid (would create a cycle). The error code `TEAM_COLL_IS_PARENT_COLL` would be returned.

The README explains why the walk-up approach is used: "Walking up follows a single chain of parentID pointers -- O(depth). Walking down would require loading the entire subtree rooted at the source -- O(subtree_size). Tree depth is typically 5-10 levels; subtree size can be hundreds or thousands."

The README also notes a known limitation: "N+1 queries in isParent -- The cycle detection algorithm makes one database query per ancestor level. For deep trees, this could be slow. A recursive CTE would reduce this to one query but adds SQL complexity."

**Source:** "Key Algorithms > Cycle Detection: Walk-Up Algorithm (isParent)" section (lines 163-177), "Design Decisions > Why Walk-Up for Cycle Detection" section (lines 207-208), "Known Limitations" item #2 (lines 261-262), "Move Between Parents" constraints (lines 156-161).

---

## Q3: Concurrent Deletes

**Question:** Two users simultaneously delete different collections from the same parent -- what happens?

**Answer:**

The README provides specific and detailed coverage of this scenario across two sections.

First, from the "Concurrency Strategy" section: every order-modifying operation opens a `prisma.$transaction`, calls `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` to acquire a pessimistic row lock on the sibling set, reads current state, performs mutations, then commits. The lock is scoped to `(teamID, parentID)`, meaning it locks the specific sibling set.

When two users simultaneously delete from the same parent:
- Both transactions attempt to acquire the pessimistic lock on the same `(teamID, parentID)` sibling set.
- One transaction acquires the lock first; the other blocks waiting.
- The first delete completes: removes its collection and decrements orderIndex for siblings after it.
- The lock is released on commit.
- The second transaction acquires the lock, reads the now-updated state, and performs its delete and reindexing.

However, the README specifically calls out that concurrent deletes are the one scenario where deadlocks can still occur. From the "Retry Strategy" section: "Delete+reindex can race with concurrent deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. When lock acquisition order differs, a deadlock occurs."

This is why delete is the ONLY operation with a retry loop. The retry handles three Prisma error codes:
- `UNIQUE_CONSTRAINT_VIOLATION` -- two operations assigned the same orderIndex
- `TRANSACTION_DEADLOCK` -- two transactions locked rows in conflicting order
- `TRANSACTION_TIMEOUT` -- lock wait exceeded timeout

The retry uses linear backoff: `retryCount * 100ms` (100, 200, 300, 400, 500ms), with maximum 5 retries and maximum total wait of 1.5 seconds. If all retries are exhausted, the operation returns `E.left(TEAM_COL_REORDERING_FAILED)`.

The README also notes a known limitation (#3): "No bulk delete optimization -- Deleting a collection deletes its children via database cascading constraints, but the sibling reindexing only handles the deleted collection's own sibling set. If multiple collections are deleted from the same parent, each delete triggers its own reindex + retry loop."

**Source:** "Concurrency Strategy" section (lines 98-121), "Retry Strategy" section (lines 241-255), "Known Limitations" item #3 (lines 263-264).

---

## Q4: Integer vs Fractional orderIndex

**Question:** Why integer orderIndex instead of fractional? Argue FOR the current design.

**Answer:**

The README provides an explicit design decision section on this topic ("Why Integer orderIndex, Not Fractional"). Here is the argument for the current integer design:

1. **Contiguity invariant guarantees consistency:** Integer orderIndex with gap-filling (decrement on delete, shift on reorder) maintains a contiguous 1..N sequence at all times. There are never gaps, never duplicates. This makes the state predictable and easy to reason about. With fractional ordering, the values can become arbitrarily irregular (e.g., 1.0, 1.5, 1.25, 1.125...) making debugging and state inspection much harder.

2. **No rebalancing needed:** Fractional ordering avoids touching siblings on mutations, but it "eventually requires rebalancing when floating-point precision is exhausted." After enough insertions between two adjacent items, the floating-point values converge and lose distinguishable precision. At that point, you need a rebalancing pass that renumbers everything -- effectively the same batch update that integer ordering does on every mutation, but triggered unpredictably and requiring additional complexity to detect and handle.

3. **Consistency over write throughput:** The README states: "For a real-time collaborative tool where consistency matters more than write throughput, integer ordering is simpler to reason about." Hoppscotch is a collaborative tool where multiple users see the same collection tree. Having a guaranteed-contiguous integer sequence is more important than minimizing the number of rows touched per write.

4. **Enables reliable cursor-based pagination:** The README explicitly notes: "The contiguous 1..N invariant also enables reliable cursor-based pagination." With fractional ordering, cursor-based pagination is more complex because you cannot assume anything about the distribution of index values. With contiguous integers, `getChildrenOfCollection(collectionID, cursor, take)` and `getTeamRootCollections(teamID, cursor, take)` can use the integer index directly for reliable offset-based cursoring.

5. **Simplicity of implementation:** The locking and range-shift algorithm is straightforward -- a single `updateMany` with a range condition handles any reorder distance in one transaction. The README's "Reorder: Range-Shift Algorithm" section shows that the entire operation is a single read + a single updateMany + a single update, all within one locked transaction.

**Source:** "Design Decisions > Why Integer orderIndex, Not Fractional" section (lines 198-200), "Key Algorithms > Reorder: Range-Shift Algorithm" section (lines 124-144), "Data Model" section (line 95).

---

## Q5: Duplication Process

**Question:** Duplicate a 3-level deep collection -- describe the process.

**Answer:**

The README describes duplication in the "Duplication: Export+Import" section under Key Algorithms, and in the "Design Decisions > Why Export+Import for Duplication" section.

The process for duplicating a 3-level deep collection (e.g., Root -> Mid -> Leaf) is:

**Step 1: Export** -- Call `exportCollectionToJSONObject(teamID, collectionID)` on the top-level collection. This recursively serializes the entire collection subtree into a `CollectionFolder` JSON object. The export traverses all three levels, capturing each collection's title, data, and nested children/requests. (Note: the README lists a known limitation #4 that "export is recursive with sequential queries -- one query per level per collection.")

**Step 2: Modify title** -- The title of the exported root collection is modified by appending `" - Duplicate"`. So if the original was "My Collection", the duplicate's root becomes "My Collection - Duplicate". The nested children retain their original titles.

**Step 3: Re-import** -- Call `importCollectionsFromJSON(jsonString, teamID, parentID)` to import the modified JSON back into the same parent as the original collection. The import logic handles:
- Creating new collection records at each level with new IDs
- Assigning correct orderIndex values at each level (using the standard locking pattern to determine the next orderIndex)
- Recreating all nested children and requests within them
- Publishing `team_coll/${teamID}/coll_added` PubSub events for each created collection

The README explains why this approach was chosen: "A dedicated deep-copy method would duplicate the recursive tree-walking, ID generation, orderIndex assignment, and locking logic that already exists in the import path. Maintaining two parallel implementations of the same algorithm is a bug factory. The serialization round-trip overhead is negligible compared to the maintenance cost of a separate code path."

So the entire 3-level duplication reuses the existing import infrastructure, including all its locking, orderIndex management, and recursive creation logic.

**Source:** "Key Algorithms > Duplication: Export+Import" section (lines 186-194), "Design Decisions > Why Export+Import for Duplication" section (lines 202-204), "Known Limitations" item #4 (lines 265-266), "PubSub Event Emission" section (lines 222-239).

---

## Q6: Adding Alphabetical Sort Feature

**Question:** If we add a "sort collections alphabetically" feature, which existing constraints and patterns apply?

**Answer:**

The README actually reveals that an alphabetical sort feature already exists: `sortTeamCollections(teamID, parentID, sortBy)` is listed among the public methods. However, if we are designing or extending this feature, the following existing constraints and patterns from the README apply:

1. **Pessimistic locking pattern (Concurrency Strategy section):** Any operation that modifies sibling orderIndex values must follow the standard pattern: open a `prisma.$transaction`, call `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` to lock the sibling set, read current state, perform mutations, commit. A sort operation rewrites all siblings' orderIndex values, so locking is mandatory.

2. **Integer orderIndex contiguity invariant (Data Model section):** The result of the sort must produce contiguous integers starting from 1. OrderIndex values must be contiguous from 1..N with no gaps and no duplicates.

3. **PubSub event emission (Cross-Cutting Concerns section):** However, the README explicitly flags a known limitation (#1): "No PubSub event for sort -- The `sortTeamCollections` method does not emit a PubSub event after reordering. Connected clients will not see the sort result in real-time unless they refresh." So the existing implementation violates the standard pattern where every mutation publishes a PubSub event. A proper implementation should publish a `team_coll/${teamID}/coll_order_updated` event after the transaction commits.

4. **fp-ts error handling (Error Handling section):** The method should return `E.Either<ErrorCode, Result>`. Business errors are returned as `E.left(ERROR_CODE)`, never thrown.

5. **Lock scope is per-parent (Concurrency Strategy section):** The lock targets `(teamID, parentID)`, so sorting one parent's children does not block operations on other subtrees.

6. **Events published AFTER transaction commit (PubSub section):** The PubSub publish calls must be placed outside the `prisma.$transaction` block to prevent phantom events.

7. **Title validation exists (Error Handling section):** `TEAM_COLL_SHORT_TITLE` is validated for minimum TITLE_LENGTH = 1 character, though this is more relevant for create/update than sort.

8. **No retry pattern for non-delete operations (Retry Strategy section):** The README notes that only delete has a retry loop. The sort operation (like move and reorder) would not have retry logic, meaning if a deadlock occurs during sort, it fails without retry. This is listed as known limitation #5.

**Source:** "Class Structure" public methods (line 59), "Concurrency Strategy" section (lines 98-121), "Data Model" section (line 95), "PubSub Event Emission" section (lines 222-239), "Known Limitations" item #1 (lines 258-259), "Error Handling" section (lines 272-298), "Retry Strategy" section (lines 241-255), "Known Limitations" item #5 (line 267).

---

## Q7: Replacing PubSub with a Message Queue

**Question:** If PubSub is replaced with a message queue, what changes in this module?

**Answer:**

Based on the README's description of PubSub usage in this module, here is what would need to change:

1. **Dependency injection (Class Structure section):** The `PubSubService` is one of the three injected dependencies. It would need to be replaced with a message queue service. The README lists it under "Dependencies (injected): PubSubService (real-time event publishing)."

2. **All mutation methods that publish events:** According to the PubSub Event Emission section, events are published on five channels:
   - `team_coll/${teamID}/coll_added` -- triggered by collection creation and import
   - `team_coll/${teamID}/coll_updated` -- triggered by title or data changes
   - `team_coll/${teamID}/coll_removed` -- triggered by collection deletion
   - `team_coll/${teamID}/coll_moved` -- triggered by move operations
   - `team_coll/${teamID}/coll_order_updated` -- triggered by reorder operations

   Each of these publish calls would need to be replaced with message queue enqueue calls.

3. **Timing rule change (PubSub section):** The README states: "Events are published AFTER the database transaction commits successfully. This prevents phantom events where a client sees an update but the transaction rolled back. The PubSub publish calls are placed outside the `prisma.$transaction` block." With a message queue, this timing rule becomes even more important. A message queue typically provides at-least-once delivery guarantees, which would address the known limitation #6: "PubSub publish is fire-and-forget -- If the PubSub publish fails after a successful database commit, clients miss the update. There is no outbox pattern or retry mechanism for event delivery." A message queue could provide this reliability, potentially via an outbox pattern.

4. **Payload shapes would need to be serialized for the queue (PubSub section):**
   - Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
   - Removed: just the collection ID string
   - Order updated: `{ collection, nextCollection }` pair

   These payloads would need to be serialized into the message queue's format, potentially with schema versioning for forward compatibility.

5. **Channel naming convention would become topic/queue naming:** The `team_coll/${teamID}/...` channel pattern would map to queue topics or routing keys.

6. **Out of Scope consideration:** The README notes that "PubSub infrastructure (delegated to PubSubService)" is out of scope for this module. If the replacement follows the same pattern of delegating infrastructure to the service layer, the changes within TeamCollectionService itself may be limited to swapping the injected service and adjusting method call signatures, with the bulk of the changes in the infrastructure layer.

7. **The known limitation about sort not emitting events (limitation #1) would still apply** unless fixed as part of the migration.

**Source:** "Class Structure > Dependencies" (lines 39-41), "PubSub Event Emission" section (lines 222-239), "Known Limitations" items #1 and #6 (lines 258-259, 269), "Out of Scope" section (lines 28-31).

---

## Q8: Removing Locking from Reorder

**Question:** A junior developer removes locking from reorder because "it's slow" -- what breaks?

**Answer:**

Removing pessimistic locking from the reorder operation (`updateCollectionOrder`) would break the core consistency guarantees of the sibling orderIndex system. Based on the README's detailed documentation:

1. **The contiguity invariant breaks (Concurrency Strategy + Reorder Algorithm sections):** The reorder algorithm follows a read-then-write pattern: it reads the current orderIndex of the collection and the next collection, then performs range shifts based on those values. Without locking, two concurrent reorders on the same sibling set would both read the SAME initial state, then both write shifts based on stale data. This produces duplicate orderIndex values, gaps in the sequence, or both -- destroying the contiguous 1..N invariant.

2. **Race condition in the re-read step (Reorder Algorithm section):** The README explicitly states that step 2 of the reorder algorithm is to "Re-read collection's current orderIndex inside transaction (guards against race conditions where orderIndex changed between initial read and lock acquisition)." Without the lock, this re-read provides no protection because another transaction can modify the values between the re-read and the subsequent updateMany.

3. **Range-shift produces wrong results (Reorder Algorithm section):** The range-shift algorithm increments or decrements siblings in a specific range based on the source and destination positions. If two concurrent reorders both compute their ranges from the same starting state, they will both shift overlapping ranges, causing some collections to be shifted twice (creating gaps elsewhere) and others not at all (creating duplicates).

4. **Specific example:** Consider siblings [A(1), B(2), C(3), D(4)]. User 1 moves A to position 3. User 2 moves D to position 2. Without locking:
   - Both read the initial state.
   - User 1 decrements B, C (range [2, 2]) and sets A=3.
   - User 2 increments B, C (range [2, 3]) and sets D=2.
   - The net effect on B and C is unpredictable depending on execution order -- they could end up with the same orderIndex, or with values outside the valid range.

5. **Cursor-based pagination breaks (Design Decisions section):** The README states that the "contiguous 1..N invariant enables reliable cursor-based pagination." With broken contiguity, `getChildrenOfCollection` and `getTeamRootCollections` (which take cursor and take parameters) would return incorrect or incomplete results.

6. **No retry mechanism to recover (Retry Strategy section):** The README states that only delete has a retry loop. Reorder has no retry mechanism. Without locking AND without retries, corrupted state becomes permanent -- there is no self-healing mechanism.

7. **PubSub events would report inconsistent state (PubSub section):** The order updated event publishes `{ collection, nextCollection }` pair. With corrupted orderIndex values, these events would communicate a state that does not match what subsequent queries return.

**Source:** "Concurrency Strategy" section (lines 98-121), "Key Algorithms > Reorder: Range-Shift Algorithm" section (lines 124-144), "Design Decisions > Why Integer orderIndex, Not Fractional" section (lines 198-200), "Retry Strategy" section (lines 241-255), "PubSub Event Emission" section (lines 222-239).
