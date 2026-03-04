# Blindfold Test -- Representation A: Yggdrasil Context Package

## Q1: Delete with Reindexing

**Delete collection C from sibling set [A(1), B(2), C(3), D(4), E(5)] -- what happens to D and E's orderIndex?**

D's orderIndex changes from 4 to 3 and E's orderIndex changes from 5 to 4. The result is [A(1), B(2), D(3), E(4)].

This follows directly from the OrderIndex contiguity constraint documented in `constraints.md`:

> "Every delete decrements all higher siblings."

The constraint requires that within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. When C (orderIndex 3) is deleted, all siblings with an orderIndex greater than 3 are decremented by 1. D (4 -> 3) and E (5 -> 4) are both affected. This ensures there are no gaps in the ordering.

The actual operation is `deleteCollectionAndUpdateSiblingsOrderIndex`, which is also noted in the `retry-on-deadlock` aspect as the operation that uses retry logic, because this delete-and-reindex pattern can race with concurrent deletes on the same sibling set.

**Sources:** `constraints.md` (OrderIndex contiguity section), `retry-on-deadlock` aspect (Where this applies section).

---

## Q2: Cycle Detection

**Move B into D in the tree A -> B -> C -> D -- is it allowed? Why or why not?**

No, it is not allowed. The move would be rejected with the error `TEAM_COLL_IS_PARENT_COLL`.

The `isParent` method (documented in `logic.md`) performs a recursive walk UP from the destination (D) toward the root, checking if it encounters the source (B) along the way:

1. Start at D. Is D === B? No.
2. D's parent is C. Is C === B? No.
3. C's parent is B. Is B === B? Yes -- return `None` (invalid).

Since B is found on the path from D up to the root, B is an ancestor of D. Moving B into D would create a cycle (D -> B -> C -> D -> ...), which would cause an infinite loop in the tree structure.

The constraint is documented in `constraints.md`:

> "A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`."

The design decision for why the algorithm walks UP rather than DOWN is documented in `decisions.md`: walking up follows a single chain of parentID pointers at O(depth) cost, whereas walking down would require loading the entire subtree at O(subtree_size) cost.

**Sources:** `constraints.md` (Circular reference prevention), `logic.md` (isParent section), `decisions.md` (Why `isParent` walks up, not down).

---

## Q3: Concurrent Deletes

**Two users simultaneously delete different collections from the same parent -- what happens?**

The system handles this through a combination of pessimistic locking and retry-on-deadlock logic. Here is what happens:

1. Both delete operations (`deleteCollectionAndUpdateSiblingsOrderIndex`) start their own Prisma transactions.
2. Each transaction attempts to acquire a row lock via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`, which locks all sibling rows under the given parent.
3. Since both operations target the same parent, they contend for the same lock. One transaction acquires it first; the other waits.

In the straightforward case, the first transaction completes (delete + decrement siblings), releases the lock, and the second transaction then proceeds with the updated state.

However, deadlocks can occur when lock acquisition order differs between the two transactions. This is precisely why the delete operation has a retry loop, as documented in the `retry-on-deadlock` aspect:

> "Delete+reorder operations use a retry loop because concurrent modifications to sibling orderIndexes can cause transient database errors."

The retry loop handles three specific Prisma error codes: `UNIQUE_CONSTRAINT_VIOLATION` (two operations assigned the same orderIndex), `TRANSACTION_DEADLOCK` (conflicting lock order), and `TRANSACTION_TIMEOUT` (lock wait exceeded). It retries up to 5 times with linear backoff (100ms, 200ms, 300ms, 400ms, 500ms). If all retries are exhausted, it returns `E.left(TEAM_COL_REORDERING_FAILED)`.

The `decisions.md` explicitly explains why delete has retries but other mutations do not:

> "Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges."

After both deletes succeed, the sibling set will have contiguous orderIndex values with no gaps -- the invariant is maintained.

Two PubSub events (`coll_removed`) will be published after each respective transaction commits, so connected clients receive real-time updates for both deletions.

**Sources:** `retry-on-deadlock` aspect (all sections), `pessimistic-locking` aspect (Pattern and Scope sections), `decisions.md` (Why delete has retries), `pubsub-events` aspect (Timing section).

---

## Q4: Integer vs Fractional orderIndex

**Why integer orderIndex instead of fractional? Argue FOR the current design.**

The context package provides an explicit rationale in `decisions.md` (Why orderIndex is integer-based, not fractional):

**1. Guaranteed contiguity and predictability.** Integer ordering with gap-filling (decrement on delete, shift on reorder) guarantees that indexes are always contiguous starting from 1 with no gaps and no duplicates. This is critical for predictable cursor-based pagination and drag-and-drop UI, as noted in the `constraints.md` OrderIndex contiguity section.

**2. Simpler reasoning in a collaborative context.** For a real-time collaborative tool where multiple users may be reordering, creating, and deleting collections simultaneously, integer ordering is simpler to reason about. You always know that a sibling set of N items has indexes 1 through N. There is no ambiguity about where an item falls or whether precision has been exhausted.

**3. No rebalancing needed.** Fractional ordering avoids touching siblings on mutations but eventually requires rebalancing when floating-point precision is exhausted. This rebalancing is a complex operation that would itself need locking and would be triggered at unpredictable times. Integer ordering never needs rebalancing because the indexes are always reset to a contiguous range.

**4. Correct lock granularity already exists.** The pessimistic locking aspect locks at the `(teamID, parentID)` scope -- just the siblings, not the entire team. Operations on different subtrees proceed in parallel. Given that this lock already exists and serializes access to the sibling set, the "cost" of touching multiple rows (the main argument against integers) is already paid. The locking infrastructure makes the write amplification of integer reindexing relatively cheap.

**5. Consistency over write throughput.** The design explicitly prioritizes consistency over write throughput. In a real-time collaboration tool, users need to see the same ordering. Integer indexes provide a single canonical representation, whereas fractional indexes can represent the same logical order with different numeric values, complicating conflict resolution.

**Sources:** `decisions.md` (Why orderIndex is integer-based, not fractional), `constraints.md` (OrderIndex contiguity), `pessimistic-locking` aspect (Scope section).

---

## Q5: Duplication Process

**Duplicate a 3-level deep collection -- describe the process.**

Duplication uses the export-then-import pattern, as documented in `decisions.md`:

**Step 1 -- Export.** The collection and its entire subtree (3 levels deep) are recursively serialized to JSON. This export captures all nested children and their requests at every level.

**Step 2 -- Title modification.** The title of the root-level collection in the exported JSON is modified by appending " - Duplicate" to it.

**Step 3 -- Re-import.** The modified JSON is fed into the existing recursive import logic. The import process:

- Creates the root-level duplicate collection under the same parent, assigning it an orderIndex of `lastIndex + 1` (appending at the end of the sibling set, per the OrderIndex contiguity constraint).
- For each level of nesting, the import recursively creates child collections, each with proper orderIndex assignment.
- Each collection creation uses the pessimistic locking pattern: open a transaction, lock siblings via `lockTeamCollectionByTeamAndParent`, read the current last orderIndex, create the new collection at `lastIndex + 1`, commit.
- Requests within each collection are also imported as part of the recursive process.

**Step 4 -- PubSub events.** After each collection is created during the import, a `coll_added` PubSub event is published on the `team_coll/${teamID}/coll_added` channel, notifying connected clients of the new collections.

The rationale for this design is documented in `decisions.md`:

> "Rather than implementing a separate deep-copy method, duplication exports the collection to JSON, modifies the title, then re-imports. This reuses the existing recursive import logic (which handles nested children, requests, locking, and orderIndex assignment) without duplicating it."

The trade-off is slightly more overhead from the serialization round-trip, but it eliminates a separate code path that would need to maintain parity with import logic.

**Sources:** `decisions.md` (Why duplication uses export + import), `constraints.md` (OrderIndex contiguity), `pessimistic-locking` aspect (Pattern section), `pubsub-events` aspect (Channel naming convention).

---

## Q6: Adding Alphabetical Sort Feature

**If we add a "sort collections alphabetically" feature, which existing constraints and patterns apply?**

Several existing constraints and patterns from the context package would apply:

**1. Pessimistic locking (aspect: `pessimistic-locking`).** Sorting reassigns orderIndex values for an entire sibling set. This absolutely must follow the pessimistic locking pattern: open a `prisma.$transaction`, call `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` to lock all siblings under the target parent, then perform the reindexing. Without this, a concurrent create/delete/reorder could interleave and produce gaps or duplicates.

**2. OrderIndex contiguity (constraint from `constraints.md`).** After sorting, the sibling set must still have contiguous integer orderIndex values starting from 1. The sort operation would read all siblings, sort them alphabetically by title, then assign orderIndex 1, 2, 3, ... N in the new alphabetical order.

**3. PubSub events (aspect: `pubsub-events`).** A mutation that changes ordering must publish a PubSub event after the transaction commits. The existing `coll_order_updated` channel (`team_coll/${teamID}/coll_order_updated`) is the appropriate channel. However, since alphabetical sort may reorder many siblings at once rather than moving a single collection, the payload shape (which currently is `{ collection, nextCollection }` pair) may need to be extended or multiple events may need to be published.

**4. Retry on deadlock (aspect: `retry-on-deadlock`).** If the sort operation touches many rows in the sibling set, it could contend with concurrent deletes or reorders. Following the pattern established by `deleteCollectionAndUpdateSiblingsOrderIndex`, the sort operation should implement a retry loop for `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, and `TRANSACTION_TIMEOUT` errors, with up to 5 retries and linear backoff.

**5. Same-team constraint (`constraints.md`).** The sort should only operate on collections within a single team. This is inherent in the locking scope which is `(teamID, parentID)`.

**6. Existing sort capability noted in scope.** The `hierarchy` section's responsibility already lists "sort" as an in-scope tree operation: "Tree operations (move between parents, reorder siblings, sort)". This suggests alphabetical sort may already exist or was anticipated in the design.

**Sources:** `pessimistic-locking` aspect (Pattern and Scope), `constraints.md` (OrderIndex contiguity), `pubsub-events` aspect (Channel naming, Timing, Payload shape), `retry-on-deadlock` aspect (Retry conditions, Strategy), `hierarchy` responsibility (In scope list).

---

## Q7: Replacing PubSub with a Message Queue

**If PubSub is replaced with a message queue, what changes in this module?**

Based on the context package, the following aspects of the TeamCollectionService would be affected:

**1. Event publishing calls.** Every mutation in the service publishes a PubSub event after the database transaction commits. These calls would need to change from the current PubSub publish mechanism to message queue enqueue calls. The five event types documented in the `pubsub-events` aspect would all need to be migrated:

- `team_coll/${teamID}/coll_added`
- `team_coll/${teamID}/coll_updated`
- `team_coll/${teamID}/coll_removed`
- `team_coll/${teamID}/coll_moved`
- `team_coll/${teamID}/coll_order_updated`

**2. Timing semantics may change.** The current design publishes events AFTER the database transaction commits to prevent phantom events (where a client sees an update but the transaction rolled back). With a message queue, this concern still applies, but the delivery guarantee changes: PubSub is fire-and-forget to connected subscribers, while a message queue typically guarantees delivery (at-least-once). This could mean:

- Events are no longer lost when no subscriber is connected (durable delivery).
- Duplicate events may be delivered (at-least-once semantics), requiring consumers to be idempotent.
- Message ordering guarantees depend on the queue implementation.

**3. Payload shapes remain the same.** The payloads documented in `pubsub-events` (full TeamCollection model for added/updated/moved, just the ID string for removed, `{ collection, nextCollection }` pair for order updated) are data-format decisions, not transport decisions. These would likely remain unchanged.

**4. Channel/topic naming convention changes.** The current naming (`team_coll/${teamID}/coll_added`) is PubSub-specific. A message queue would likely use topic/queue names with similar semantics but different naming conventions.

**5. PubSub infrastructure dependency is out of scope for this module.** The `responsibility.md` explicitly states "PubSub infrastructure (delegated to PubSubService)" is out of scope. This means the TeamCollectionService likely calls a PubSubService abstraction. If the replacement message queue is wrapped in a similar service abstraction, the changes to TeamCollectionService could be minimal -- just updating the injected service dependency and method calls.

**6. The `pubsub-events` aspect would need to be renamed/updated.** This aspect is referenced by both the hierarchy node and the TeamCollectionService node. Its content (channel naming, timing rules, payload shapes) would need to be rewritten for the message queue paradigm.

**What does NOT change:** The pessimistic locking pattern, the retry-on-deadlock logic, all tree integrity constraints (cycle detection, orderIndex contiguity, same-team), and the core business logic (CRUD, reorder, move, duplicate, search) are all independent of the event transport mechanism.

**Sources:** `pubsub-events` aspect (all sections), `responsibility.md` (Out of scope -- PubSub infrastructure), `node.yaml` (aspects list includes pubsub-events).

---

## Q8: Removing Locking from Reorder

**A junior developer removes locking from reorder because "it's slow" -- what breaks?**

Removing the pessimistic locking from reorder operations would break several critical invariants:

**1. OrderIndex contiguity breaks.** The `constraints.md` requires orderIndex values to be contiguous starting from 1 within each sibling set. The reorder algorithm (documented in `logic.md`) is a multi-step read-then-write operation:

- Read the current orderIndex of the collection being moved and its target position.
- Shift a range of siblings up or down by 1.
- Set the moved collection's new orderIndex.

Without locking, two concurrent reorders on the same sibling set would each read the current state, compute their shifts independently, then write conflicting updates. The result would be **duplicate orderIndex values** (two collections with the same index) and/or **gaps** (missing index values). This directly violates the contiguity invariant that is "critical for predictable cursor-based pagination and drag-and-drop UI."

**2. Stale reads cause incorrect shifts.** The reorder algorithm in `logic.md` explicitly re-reads the collection's orderIndex inside the transaction as a "race condition guard." Without the lock, even this re-read is insufficient because another operation could modify siblings between the re-read and the subsequent updateMany. The algorithm determines direction (`isMovingUp = nextCollection.orderIndex < collection.orderIndex`) based on read values -- if those values change between read and write, the wrong range of siblings gets shifted.

**3. Lost updates on concurrent operations.** Without locking, two reorders could read the same sibling set state, then both write their shifts. The second write would overwrite the first's shifts without accounting for them. For example: if User A moves collection X and User B moves collection Y in the same sibling set simultaneously, one user's reorder would be silently lost or corrupted.

**4. Create and delete operations also break.** The pessimistic locking aspect states that "every operation that reads and then modifies sibling orderIndex values must acquire a row lock first." This includes create (which reads `lastIndex + 1`) and delete (which decrements higher siblings). Even if only reorder's lock is removed, a concurrent create or delete on the same sibling set would now race with the unlocked reorder, producing inconsistent state.

**5. The pessimistic locking design is intentional and justified.** The `pessimistic-locking` aspect explicitly addresses the "why not optimistic" question: optimistic locking (version columns + retry) is impractical for reorder because reorder touches MANY siblings via range-based updateMany operations. A single conflicting row would invalidate the entire batch. Pessimistic locking serializes access to the sibling set, which is the correct granularity.

**6. The lock scope is already optimized.** The lock is scoped to `(teamID, parentID)`, not the entire team's collections. Operations on different subtrees already proceed in parallel. The "slowness" concern is likely overstated because contention only occurs between operations on siblings under the same parent.

In summary: removing locking from reorder would corrupt the ordering system, break the drag-and-drop UI, cause data inconsistencies in a collaborative environment, and undermine the fundamental tree integrity guarantees of the service.

**Sources:** `pessimistic-locking` aspect (all sections, especially "Why pessimistic, not optimistic" and "Scope"), `constraints.md` (OrderIndex contiguity), `logic.md` (Reorder algorithm -- both cases), `decisions.md` (Why orderIndex is integer-based).
