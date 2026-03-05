# Reagent Atomicity

## Requirement

When a recipe phase requires multiple reagents from shared inventory, the allocation must be atomic: either all required reagents are reserved, or none are. Partial allocation (some reagents reserved, others unavailable) must never persist.

## Rules

1. **All-or-nothing allocation**: Before a phase begins, the reagent inventory must attempt to reserve all required reagents in a single atomic operation. If any reagent is insufficient, all reservations for that phase are rolled back. The phase enters a `waiting_for_reagents` state.

2. **Reservation vs consumption**: Allocation has two stages: reservation (quantity marked as reserved, still physically in inventory) and consumption (quantity deducted after phase successfully uses it). If a phase fails after reservation but before consumption, reserved quantities are returned to available inventory.

3. **Priority-based conflict resolution**: When two phases compete for the same reagent and insufficient quantity exists for both, priority is determined by: (a) recipe priority (user-assigned, integer, lower is higher priority), then (b) phase deadline proximity (phase closer to its deadline wins), then (c) FIFO order of request arrival.

4. **No borrowing**: A phase cannot "borrow" reagents reserved by another phase, even if that phase has not yet consumed them. Reserved reagents are unavailable to all other phases. Rationale: borrowing creates circular dependencies and potential deadlocks.

5. **Quantity tracking in micrograms**: All reagent quantities are tracked as integer micrograms to avoid floating-point precision errors. Conversion to/from display units (grams, milliliters) happens at the API boundary only.

## Rejected Alternatives

- **Partial allocation with backfill**: rejected because a phase with partial reagents cannot safely begin. Chemical reactions require precise stoichiometric ratios; partial reagents produce wrong products.
- **Optimistic allocation (allocate, then check)**: rejected because it creates a window where two phases believe they have the same reagent. Pessimistic (check-then-allocate) is safer even though it reduces throughput.
- **Floating-point quantities**: rejected because accumulated floating-point drift across many allocations and returns would cause inventory accounting errors. Integer micrograms are exact.
