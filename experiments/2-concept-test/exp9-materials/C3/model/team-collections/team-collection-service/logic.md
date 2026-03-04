# TeamCollectionService — Logic

## Reorder algorithm (updateCollectionOrder)

Two cases based on `nextCollectionID`:

### Move to end (nextCollectionID = null)

1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Find the sibling currently at the last position (highest orderIndex)
4. Swap the orderIndex values of the collection and the last sibling (direct swap of two rows)
5. If the collection is already last, no-op

### Move to specific position (nextCollectionID != null)

1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Swap the orderIndex values of the two collections directly — the source collection takes the target's orderIndex, and the target takes the source's orderIndex
4. No other siblings are modified; only the two involved collections exchange positions

The "next collection" semantics mean: "swap my position with this collection."

## isParent (circular reference check)

Recursive walk from destination UP to root:
1. If source === destination -> return None (invalid, means self-move)
2. If destination.parentID === source.id -> return None (source IS an ancestor)
3. If destination.parentID !== null -> recurse with destination = destination.parent
4. If destination.parentID === null -> reached root without finding source -> return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

## Move collection (changeParentAndUpdateOrderIndex)

1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents within a single transaction.
