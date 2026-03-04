# M3 Gold Standard — Invariant-Breaking Change (Remove Delete Locking)

## Summary of Change

Removed pessimistic locking AND the retry loop from `deleteCollectionAndUpdateSiblingsOrderIndex`:

1. **Removed** the `lockTeamCollectionByTeamAndParent` call from the delete transaction
2. **Removed** the retry loop (`while (retryCount < this.MAX_RETRIES)`)
3. **Removed** the retry condition checks (UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT)
4. **Removed** the `delay(retryCount * 100)` backoff
5. **Simplified** to a single `try/catch` around a bare `$transaction`

All other operations (create, import, move, reorder, sort) STILL use pessimistic locking.

## Artifacts That Need Updating

### logic.md

**No direct change needed.** The logic.md does not describe the delete algorithm in detail (the reorder algorithm is described but delete is not). However, if the logic.md were to be expanded, the delete operation now has a simpler flow: just transaction -> delete -> update siblings -> done.

### constraints.md

**Change needed — add a WARNING or update the OrderIndex contiguity constraint.**

The "OrderIndex contiguity" constraint states: "Every delete decrements all higher siblings." This is still true at the code level, but without locking, two concurrent deletes can read stale orderIndex values and produce gaps or duplicates. The constraint is no longer reliably enforced under concurrency.

Add:
```
## WARNING: OrderIndex contiguity under concurrent deletes

The delete operation no longer acquires a pessimistic lock before modifying sibling orderIndexes. Under concurrent deletes on the same sibling set, the orderIndex contiguity invariant may be violated: two transactions may each read the same orderIndex state, both decrement overlapping ranges, and produce gaps or duplicate indexes. This is a known regression from removing locking.
```

### decisions.md

**Change needed — document WHY locking was removed from delete.**

The existing decision "Why delete has retries but other mutations do not" is now outdated. It should be updated or replaced:

Remove or update:
```
## Why delete has retries but other mutations do not
```

Replace with:
```
## Why delete no longer uses pessimistic locking or retries

The pessimistic lock and retry loop were removed from the delete operation to simplify the code path. The original design used locking because concurrent deletes on the same sibling set could race, but the retry loop added complexity (5 retries, linear backoff, error code filtering). The tradeoff: simpler code at the cost of potential orderIndex inconsistency under high concurrent delete load. [NOTE: This decision should be flagged for review — it breaks the pessimistic-locking invariant.]
```

### responsibility.md

**No change needed.** The responsibility is still "delete with sibling reindexing" — the implementation detail of locking is captured in aspects and constraints, not responsibility.

## Aspects Affected

### pessimistic-locking aspect — VIOLATION

**This is the critical finding.** The pessimistic-locking aspect states:

> "Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first."

The delete operation reads sibling state and then modifies orderIndex values (decrements siblings above the deleted collection). By removing the lock, this operation **violates the aspect's invariant**.

**Expected agent behavior:** Flag this as an aspect violation. The agent should NOT silently update the aspect to exclude delete. Instead, it should:
1. Report the violation
2. Ask whether the aspect should be narrowed (excluding delete) or the code should be fixed (re-add locking)

If the aspect is narrowed, update `aspects/pessimistic-locking/content.md`:
```
## Scope

The lock is scoped to `(teamID, parentID)` — it locks siblings, not the entire team's collections. This means operations on different subtrees can proceed in parallel.

**Exception:** The delete operation (`deleteCollectionAndUpdateSiblingsOrderIndex`) does NOT acquire a lock. This is a known deviation — see decisions.md for rationale.
```

### retry-on-deadlock aspect — VIOLATION

**The entire retry-on-deadlock aspect no longer applies to this service.**

The aspect states:

> "Currently only `deleteCollectionAndUpdateSiblingsOrderIndex`."

Since the retry loop was removed from that method (and no other method uses retries), the retry-on-deadlock aspect is now **dead code** in the graph. The aspect still exists but has zero applicability.

**Expected agent behavior:**
1. Flag that the retry-on-deadlock aspect no longer applies to this node
2. Ask whether to remove the aspect from the node's aspect list in node.yaml
3. If removed, update node.yaml: `aspects: [pessimistic-locking, pubsub-events]` (remove `retry-on-deadlock`)

### pubsub-events aspect

**No change needed.** The delete still publishes `coll_removed` after deletion succeeds.

## Aspect Violations

1. **pessimistic-locking: VIOLATED.** Delete reads-then-modifies sibling orderIndexes without locking.
2. **retry-on-deadlock: ORPHANED.** The aspect has no applicability in this service after the change.

## node.yaml

**Change needed:** Remove `retry-on-deadlock` from the aspects list (pending user confirmation).

Current:
```yaml
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]
```

Updated:
```yaml
aspects: [pessimistic-locking, pubsub-events]
```

Note: The `pessimistic-locking` aspect should arguably also be qualified or flagged, since delete now violates it. But removing it entirely would be wrong because create, import, move, reorder, and sort still use it.

## Difficulty Assessment

**Hard recovery.** An agent must:
1. Detect that locking was removed from ONE specific method (not all)
2. Detect that the retry loop was also removed
3. Understand that this breaks two aspects: the locking invariant AND the retry pattern
4. Correctly identify that the retry-on-deadlock aspect is now completely inapplicable
5. NOT silently "fix" the graph to match the code — instead flag the violations
6. Update decisions.md with the rationale (or ask for it)
7. Update constraints.md to warn about the concurrency regression

The key difficulty is that this requires understanding cross-cutting invariants, not just local code changes. A naive agent would just update the code description and miss the aspect violations entirely.
