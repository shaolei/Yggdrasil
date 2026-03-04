# Consistency Review: TeamCollectionService Graph vs Source Code

**Source code:** `packages/hoppscotch-backend/src/team-collection/team-collection.service.ts`
**Graph artifacts:** `/workspaces/memory2/exp9-materials/C1/`

---

## Inconsistencies Found

| # | Graph artifact | Claim in graph | Code evidence | Severity |
|---|---|---|---|---|
| 1 | `aspects/pessimistic-locking/aspect.yaml` + `content.md` | The aspect is named **"Optimistic Locking"** and describes "version-field based conflict detection." Content says: "Every operation that reads and then modifies sibling orderIndex values uses optimistic locking with a version field. Each collection row carries a `version` integer that is checked at write time." | The code uses `lockTeamCollectionByTeamAndParent()` which executes `SELECT "orderIndex" FROM "TeamCollection" WHERE ... FOR UPDATE` -- this is **pessimistic locking** via row-level exclusive locks. There is **no `version` field** anywhere in the code. No `WHERE version = expectedVersion` clause exists. The directory name `pessimistic-locking` contradicts the file's own content of "Optimistic Locking." | **CRITICAL** |
| 2 | `aspects/pessimistic-locking/content.md` | "If the version has changed since the read, the operation is retried with fresh data" and "version conflicts are retried transparently, and the common case (no conflict) completes without any lock wait." | There is no version-based retry in any method except `deleteCollectionAndUpdateSiblingsOrderIndex`, which retries on Prisma error codes (deadlock, unique constraint, timeout) -- not on version conflicts. All other mutating methods (`createCollection`, `moveCollection`, `updateCollectionOrder`) do NOT retry at all. | **CRITICAL** |
| 3 | `aspects/pessimistic-locking/content.md` | "The version field is per-row -- each collection tracks its own version independently. Conflicts are detected at the individual row level, not at the sibling-set level." | No `version` field exists on the `TeamCollection` model. The locking granularity is at the **sibling set level** (`SELECT ... WHERE teamID = X AND parentID = Y FOR UPDATE`), which locks ALL siblings under a parent, not individual rows. | **CRITICAL** |
| 4 | `aspects/retry-on-deadlock/content.md` | "Delay: **linear** backoff `retryCount * 100ms` (**100ms, 200ms, 300ms, 400ms, 500ms**)" and "The maximum total wait is **1.5 seconds**" | Code: `await delay(retryCount * 100)` where retryCount goes 1, 2, 3, 4 before exit at 5. The 5th failure (retryCount=5) exits immediately without delay, so the actual delays are **100ms, 200ms, 300ms, 400ms** (no 500ms delay). The maximum total wait is **1.0 seconds**, not 1.5 seconds. | **MODERATE** |
| 5 | `aspects/retry-on-deadlock/aspect.yaml` | Named "Retry on Deadlock" with description "**Exponential** retry for specific database transaction errors" | The code uses **linear** backoff (`retryCount * 100`), not exponential. The content.md file correctly says "linear" and even has a section "Why linear, not exponential." The aspect.yaml description contradicts its own content.md. | **MODERATE** |
| 6 | `aspects/pubsub-events/content.md` | "Events are published **AFTER the database transaction commits** successfully. This prevents phantom events where the client sees an update but the transaction rolled back." | In `moveCollection()` (lines 776-779 and 825-828), `this.pubsub.publish()` is called **INSIDE** the `$transaction` callback, meaning the event fires **BEFORE** the transaction commits. If the transaction were to fail after the publish call, a phantom event would be emitted. | **MODERATE** |
| 7 | `aspects/pubsub-events/content.md` | "Every mutation to a team collection publishes a PubSub event so that connected clients receive real-time updates." | `sortTeamCollections()` (lines 1502-1549) is a mutation that reorders all siblings by title but does **NOT** publish any PubSub event. This violates the stated invariant. | **MODERATE** |
| 8 | `model/team-collections/team-collection-service/responsibility.md` | "Coordinates Prisma database transactions with **pessimistic row locking**" | While the code does use pessimistic row locking (`SELECT ... FOR UPDATE`), the aspect named `pessimistic-locking` that is referenced in node.yaml actually describes optimistic locking with version fields. There is an internal contradiction: the responsibility says "pessimistic," the linked aspect says "optimistic." | **MODERATE** |
| 9 | `aspects/retry-on-deadlock/content.md` | "Other order mutations (create, move, reorder) do NOT retry -- they rely solely on **pessimistic locking**." | This statement is factually correct about the code behavior, but it references "pessimistic locking" while the linked `pessimistic-locking` aspect describes optimistic locking. The cross-reference is inconsistent. | **MINOR** |
| 10 | `flows/collection-management/description.md` | Under "Move collection" step 3: "Lock destination's sibling set (if moving into a collection)" | Code (lines 810-814) calls `lockTeamCollectionByTeamAndParent(tx, destCollection.right.teamID, destCollection.right.parentID)` which locks the **siblings of the destination** (same parent as dest), NOT the **children of the destination** (which will become the moved collection's new siblings). The `changeParentAndUpdateOrderIndex` method then operates on children of dest without an explicit lock on that set. The graph description matches the code, but both may be describing a bug. | **MINOR** |
| 11 | `flows/collection-management/description.md` | Invariant: "Every sibling-order mutation acquires a **pessimistic row lock** before reading orderIndex values" | Correct behavior in code, but again references "pessimistic" locking while the graph's own `pessimistic-locking` aspect describes optimistic locking. | **MINOR** |
| 12 | `model/team-collections/team-collection-service/decisions.md` | "Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The **pessimistic lock** prevents data corruption but can cause deadlocks when lock acquisition order differs." | This accurately describes how `SELECT ... FOR UPDATE` works, but the referenced `pessimistic-locking` aspect in the graph describes optimistic locking, creating a contradiction within the graph. | **MINOR** |

---

## Consistent Claims (summary)

The following areas of the graph accurately reflect the source code:

- **Constraints (constraints.md):** All constraint descriptions are accurate -- circular reference prevention via `isParent`, orderIndex contiguity starting from 1, same-team check, self-move prevention, already-root guard, title minimum length of 1 character, and data field validation (empty string rejected, invalid JSON rejected).
- **Logic (logic.md) - Reorder algorithm:** The detailed description of `updateCollectionOrder` for both "move to end" and "move to specific position" cases matches the code exactly, including the range calculations and direction logic.
- **Logic (logic.md) - isParent algorithm:** The recursive walk-up logic, None/Some return semantics, and termination conditions all match the code.
- **Logic (logic.md) - changeParentAndUpdateOrderIndex:** The three-step process (find last under new parent, decrement old siblings, update collection) matches exactly.
- **Decisions (decisions.md):** The rationale for duplication via export+import, raw SQL for search, recursive CTE for parent trees, isParent walking up vs down, and integer-based orderIndex are all consistent with code patterns.
- **PubSub channel naming (pubsub-events content.md):** All five channel patterns (`coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated`) with their `team_coll/${teamID}/` prefix match the code exactly.
- **PubSub payload shapes:** Added/Updated/Moved use full TeamCollection model (via `this.cast()`), Removed uses just the ID string, and Order updated uses `{ collection, nextCollection }` pairs -- all confirmed in code.
- **Retry error codes:** The three retried Prisma error codes (`UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, `TRANSACTION_TIMEOUT`) match exactly.
- **MAX_RETRIES = 5:** The constant value matches.
- **Search implementation:** Raw SQL with `ILIKE`, `similarity()`, `escapeSqlLikeString`, and recursive CTE for parent tree reconstruction all confirmed.
- **Duplication pattern:** Export to JSON, append " - Duplicate" to title, re-import -- all confirmed.
- **CLI support methods:** `getCollectionForCLI` and `getCollectionTreeForCLI` exist as described.
- **Flow participants and paths:** The overall structure of create, delete, move, reorder, search, import, and duplicate paths are accurately described.
- **fp-ts Either usage:** All business errors return `E.left`, never throw -- confirmed across all methods.

---

## Overall Assessment

**The graph is partially trustworthy but contains one systemic and critical error that undermines trust in the locking aspect.**

### Systemic Issue: The "pessimistic-locking" aspect describes the wrong locking strategy

The most damaging inconsistency is that the `pessimistic-locking` aspect -- referenced by both the parent module and the service node -- describes **optimistic locking with version fields** when the code actually uses **pessimistic locking with `SELECT ... FOR UPDATE`**. This is not a small naming error; the entire content.md for this aspect is fabricated. There is no version field, no version check, no transparent retry-on-conflict. The aspect directory is correctly named `pessimistic-locking`, but its content describes the opposite strategy. This creates a cascading problem: every other artifact that references "pessimistic locking" is internally consistent with the code, but the actual aspect definition contradicts them all.

### Secondary Issues

- The retry-on-deadlock aspect.yaml says "exponential" while its own content.md says "linear" -- an internal contradiction within the same aspect.
- The retry delay sequence is overstated (claims 5 delays totaling 1.5s; actual is 4 delays totaling 1.0s).
- The PubSub timing guarantee ("after commit") is violated by `moveCollection` which publishes inside the transaction.
- The "every mutation publishes" invariant is violated by `sortTeamCollections`.

### Trust Rating

- **Constraints, logic algorithms, decisions:** HIGH trust -- detailed and accurate
- **PubSub events (channels, payloads):** HIGH trust -- accurate
- **PubSub timing and completeness:** MODERATE trust -- two exceptions found
- **Retry behavior:** MODERATE trust -- correct structure but wrong delay numbers
- **Locking aspect:** VERY LOW trust -- fundamentally wrong description of the mechanism used
