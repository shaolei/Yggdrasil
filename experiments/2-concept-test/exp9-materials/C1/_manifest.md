# C1 — Strategy Reversal (LOW subtlety)

## Subtlety: LOW

## What was changed

### Modified files
1. **aspects/pessimistic-locking/content.md** — Complete rewrite
2. **aspects/pessimistic-locking/aspect.yaml** — Name and description changed

### Nature of the contradiction

The entire pessimistic locking aspect was replaced with an optimistic locking strategy.
The original describes:
- Row-level pessimistic locks via `prisma.lockTeamCollectionByTeamAndParent()`
- Lock scoped to `(teamID, parentID)` sibling set
- Rationale: optimistic locking impractical because reorder touches MANY siblings via `updateMany`

The modified version describes:
- Optimistic locking with a per-row `version` field and `WHERE version = expected` clauses
- Version conflicts detected at individual row level, not sibling-set level
- Rationale: pessimistic locking blocks concurrent readers unnecessarily

### Why this contradicts the codebase

The actual code uses `lockTeamCollectionByTeamAndParent()` which is a SELECT FOR UPDATE
(pessimistic row lock). There is no `version` column on TeamCollection. The `updateMany`
calls in reorder use range conditions, not version checks. Multiple other artifacts
(constraints.md, flow description, decisions.md) all reference pessimistic locking,
creating an internal inconsistency within this variant's own artifacts as well.

### Cross-artifact contradictions within this variant

- constraints.md still says "Every sibling-order mutation acquires a pessimistic row lock"
- flow description.md still says "Lock sibling rows under the target parent"
- decisions.md still references "pessimistic lock prevents data corruption"
- The aspect name in node.yaml is still `pessimistic-locking` but the content describes optimistic

## Expected detection: Easy. The strategy name itself is reversed. Multiple internal contradictions.
