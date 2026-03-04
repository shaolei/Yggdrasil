# TeamCollectionService — Constraints

## Circular reference prevention

A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This prevents infinite loops in the tree structure.

## OrderIndex contiguity

Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1. This invariant ensures no gaps and no duplicates, which is critical for predictable cursor-based pagination and drag-and-drop UI.

## Same-team constraint

A collection can only be moved to a parent that belongs to the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`.

## Self-move prevention

A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered next to itself (`TEAM_COL_SAME_NEXT_COLL`).

## Already-root guard

Moving a root collection to root (parentID null → null) is rejected with `TEAM_COL_ALREADY_ROOT`. This is a no-op prevention, not a business rule.

## Title minimum length

Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.

## Data field validation

The optional `data` field (collection metadata/headers) must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`.
