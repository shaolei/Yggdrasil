# C4 — Subtle Inversion (HIGH subtlety)

## Subtlety: HIGH

## What was changed

### Modified files
1. **aspects/retry-on-deadlock/content.md** — "Where this applies" section inverted
2. **model/team-collections/team-collection-service/decisions.md** — Corresponding decision inverted
3. **flows/collection-management/description.md** — Retry steps moved from Delete to Create/Move/Reorder

### Nature of the contradiction

The original states:
> Currently only `deleteCollectionAndUpdateSiblingsOrderIndex`. Other order mutations
> (create, move, reorder) do NOT retry — they rely solely on pessimistic locking.
> The delete operation needs retries because it can race with concurrent deletes on the
> same sibling set.

The modified version states:
> Retries apply to create, move, and reorder operations — all mutations that modify sibling
> orderIndex ranges. The delete operation does NOT use retries because delete is idempotent:
> once a row is removed, re-running the delete has no additional effect.

### Why the inversion is plausible but wrong

The fabricated reasoning sounds convincing:
- "Delete is idempotent" — true in general, but the issue isn't the delete itself, it's the
  sibling reindexing AFTER the delete, which is NOT idempotent
- "Create/move/reorder can produce duplicate orderIndex" — true in theory, but in practice
  the pessimistic lock serializes them adequately; it's the delete that creates overlapping
  range windows because two deletes may each start a transaction before either acquires the lock

### What makes this HIGH subtlety

1. All three modified files are internally consistent with each other (no cross-artifact contradiction within the variant)
2. The fabricated reasoning (idempotency argument) sounds technically correct
3. The actual code function name `deleteCollectionAndUpdateSiblingsOrderIndex` contains a retry
   loop, but the agent would need to know the code to catch this
4. The retry error codes and strategy are unchanged — only the SCOPE is inverted
5. The flow description was updated to move retry mentions to create/move/reorder paths,
   so even the process description is consistent with the inversion

### Cross-artifact consistency within this variant
- retry-on-deadlock aspect: says create/move/reorder retry, delete does not
- decisions.md: explains why create/move/reorder retry, delete does not
- flow description: retry steps appear on create/move/reorder paths, NOT on delete path
- All three are consistent with each other, making the inversion harder to detect

## Expected detection: Hard. Requires knowing the actual code behavior or reasoning carefully about WHY delete specifically would have the race condition (overlapping range windows from concurrent deletes).
