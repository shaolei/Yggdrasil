# C3 — Stale Algorithm (MEDIUM subtlety)

## Subtlety: MEDIUM

## What was changed

### Modified files
1. **model/team-collections/team-collection-service/logic.md** — Reorder algorithm replaced

### Nature of the contradiction

The original reorder algorithm (`updateCollectionOrder`) uses a "shift range" approach:
- **Move to end:** Decrement all siblings with orderIndex > current, set collection to count
- **Move to specific position:** Determine direction (up/down), shift the affected RANGE of
  siblings by +1 or -1, place collection at target position
- This maintains contiguity by shifting an entire range of intermediate siblings

The modified version describes a simple "swap positions" algorithm:
- **Move to end:** Swap orderIndex with the sibling currently at the last position
- **Move to specific position:** Swap orderIndex values of the two collections directly;
  no other siblings are modified

### Why this contradicts the codebase

The actual code uses `prisma.teamCollection.updateMany()` with range conditions like
`orderIndex: { gte: X, lte: Y }` to shift multiple siblings. A swap algorithm would only
touch 2 rows, but the code clearly touches a range. The swap algorithm also violates the
contiguity invariant: if you swap positions 2 and 5 in a set [1,2,3,4,5], you get
[1,5,3,4,2] — gaps appear relative to the original ordering expectation.

### Cross-artifact contradictions within this variant

- constraints.md says "Reorder shifts affected ranges up or down by 1" — contradicts the swap
- flow description says "shift affected range by +1 or -1" — contradicts the swap
- The "next collection" semantics are changed from "place me just before this collection"
  to "swap my position with this collection" — different semantic meaning

### What was NOT changed
- isParent algorithm (unchanged)
- Move collection algorithm (unchanged)
- All other files unchanged

## Expected detection: Medium. The swap algorithm sounds plausible but contradicts constraints.md and the flow description's range-shift language.
