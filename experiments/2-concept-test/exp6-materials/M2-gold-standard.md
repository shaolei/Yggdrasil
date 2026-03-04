# M2 Gold Standard — Behavioral Change (Reorder Semantics)

## Summary of Change

Modified `updateCollectionOrder` to change from "place BEFORE nextCollection" semantics to "place AFTER targetCollection" semantics:

- **Old:** `nextCollectionID` means "put me just before this collection." `null` means "move to end."
- **New:** `targetCollectionID` means "put me right after this collection." `null` means "move to beginning."

The index calculation logic changed accordingly:
- **Moving UP (target is above):** shift range is `[target.orderIndex + 1, collection.orderIndex - 1]` (increment), final position = `target.orderIndex + 1`
- **Moving DOWN (target is below):** shift range is `[collection.orderIndex + 1, target.orderIndex]` (decrement), final position = `target.orderIndex`
- **Null case:** Instead of moving to end (decrement after, set to count), now moves to beginning (increment all below, set to 1)

Everything else preserved: locking, PubSub events, error handling.

## Artifacts That Need Updating

### logic.md

**Change:** The reorder algorithm description must be completely rewritten.

Current:
```
## Reorder algorithm (updateCollectionOrder)

Two cases based on `nextCollectionID`:

### Move to end (nextCollectionID = null)
1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

### Move to specific position (nextCollectionID != null)
1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up → `nextCollection.orderIndex`, if moving down → `nextCollection.orderIndex - 1`

The "next collection" semantics mean: "place me just before this collection."
```

Updated:
```
## Reorder algorithm (updateCollectionOrder)

Two cases based on `targetCollectionID`:

### Move to beginning (targetCollectionID = null)
1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Increment all siblings with orderIndex < current (makes room at position 1)
4. Set collection's orderIndex = 1 (puts it at the beginning)

### Move after specific collection (targetCollectionID != null)
1. Lock siblings
2. Re-read BOTH collection and targetCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = targetCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[targetCollection.orderIndex + 1, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, targetCollection.orderIndex]`
6. Set collection's orderIndex to: if moving up → `targetCollection.orderIndex + 1`, if moving down → `targetCollection.orderIndex`

The "target collection" semantics mean: "place me right after this collection."
```

### responsibility.md

**Change:** Update the "Tree operations" bullet to reflect the new semantics.

Current:
```
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
```

Updated (minor — the responsibility description is high-level enough that it doesn't strictly need a change, but the reorder description in logic.md is critical).

### constraints.md

**Change:** The "OrderIndex contiguity" constraint description mentions "Every create appends at lastIndex + 1. Reorder shifts affected ranges up or down by 1." This is still true but should be reviewed. The invariant itself (contiguous starting from 1) is unchanged. No change needed.

### decisions.md

**Change:** Add a new decision explaining why the semantics changed.

Add:
```
## Why reorder changed from "place before" to "place after" semantics

The original "place before nextCollection" semantics required the UI to know which collection the dragged item should appear before. This is unintuitive for drag-and-drop: when a user drops an item, they typically think "I want this after X" not "I want this before Y." The "place after targetCollection" semantics align better with the mental model. The null case also changed: null now means "move to beginning" (no target = before everything) rather than "move to end."
```

## Aspects Affected

### pessimistic-locking aspect

**No change needed.** Locking is still used in the same pattern. The lock scope is unchanged.

### pubsub-events aspect

**Minor change recommended:** The PubSub payload for `coll_order_updated` still sends `{ collection, nextCollection }`. With the new semantics, the second field semantically represents the target (after which the collection was placed), not the next collection. The payload shape key name is misleading but functionally identical. Document this:

Add note:
```
Note: The `coll_order_updated` payload field is named `nextCollection` for backward compatibility but now represents the target collection (the collection AFTER which the moved collection was placed).
```

### retry-on-deadlock aspect

**No change needed.** The reorder method does not use retry-on-deadlock (only delete does).

## Aspect Violations

**None.** All aspects are still satisfied. Locking is still used, PubSub events are still published after commit.

## node.yaml

**No change needed.**

## Difficulty Assessment

**Medium recovery.** An agent should:
1. Detect the behavioral change in the reorder algorithm (the core logic shifted)
2. Completely rewrite the logic.md reorder algorithm section
3. Add a decisions.md entry explaining why the semantics changed
4. Notice the null-case flip (end -> beginning) and update logic.md accordingly
5. Optionally note the PubSub payload naming inconsistency

The challenge is that the agent must understand the SEMANTIC meaning of the index calculations, not just detect line-level diffs. The shift ranges and final positions changed in a way that requires understanding what "place before" vs "place after" means algorithmically.
