# C2 — Missing Invariant (MEDIUM subtlety)

## Subtlety: MEDIUM

## What was changed

### Modified files
1. **aspects/pubsub-events/content.md** — Removed the "Timing" section entirely

### Nature of the contradiction

The original pubsub-events content.md contains a critical "Timing" section:

> Events are published AFTER the database transaction commits successfully. This prevents
> phantom events where the client sees an update but the transaction rolled back. The
> exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens
> after the retry loop succeeds.

This entire section was removed. The modified file only contains:
- Channel naming convention
- Payload shape

### Why this matters

The timing invariant is one of the most important correctness properties of the PubSub
system. Without it, an agent reviewing the graph would have no indication that:
1. Events must be emitted AFTER transaction commit (not inside the transaction)
2. Phantom events (events for rolled-back transactions) are a known concern
3. The delete path has a special exception (events after retry loop, not after single tx)

An agent working from this graph might reasonably:
- Emit events inside a transaction (causing phantom events on rollback)
- Not understand the delete path's special PubSub timing
- Miss the invariant during code review

### What was NOT changed
- aspect.yaml is unchanged
- All other artifacts are unchanged
- The flow description still mentions "Publish event" steps but does not specify timing

## Expected detection: Medium. The absence is the only signal. An agent must notice what's MISSING, not what's wrong.
