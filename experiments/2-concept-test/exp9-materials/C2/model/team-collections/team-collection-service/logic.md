# TeamCollectionService — Logic

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

## isParent (circular reference check)

Recursive walk from destination UP to root:
1. If source === destination → return None (invalid, means self-move)
2. If destination.parentID === source.id → return None (source IS an ancestor)
3. If destination.parentID !== null → recurse with destination = destination.parent
4. If destination.parentID === null → reached root without finding source → return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

## Move collection (changeParentAndUpdateOrderIndex)

1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents within a single transaction.
