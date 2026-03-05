# Contamination Propagation

## Requirement

When a recipe phase fails during execution on shared equipment, a contamination event must be raised. Every other recipe currently using or scheduled to use the same equipment must be evaluated for impact.

## Rules

1. **Immediate notification**: The scheduler must notify all affected recipes within the same tick (synchronously within the event loop iteration) of detecting contamination. Rationale: delayed notification risks a contaminated recipe proceeding to its next phase on dirty equipment.

2. **Contamination scope**: Contamination is equipment-scoped, not recipe-scoped. If Recipe A fails on Reactor-3, only recipes using Reactor-3 are affected — not recipes sharing reagents with Recipe A but using different equipment.

3. **Cascade depth limit**: Contamination cascades (Recipe A contaminates equipment, Recipe B aborts and contaminates its equipment) are tracked with a depth counter. Maximum cascade depth: 5. Beyond that, the system enters emergency halt. Rationale: unbounded cascades indicate systemic failure, not recoverable state.

4. **Decontamination as phase**: Equipment decontamination is modeled as a special recipe phase (type: "decontamination") that occupies the equipment exclusively. It must complete before any new recipe phase can use that equipment.

5. **Contamination record**: Every contamination event is recorded with: source recipe, source phase, affected equipment, timestamp, cascade depth, and list of affected recipes. This record is immutable after creation.

## Rejected Alternatives

- **Recipe-scoped contamination** (contaminate everything Recipe A touches): rejected because it creates false positives. A recipe may use 5 pieces of equipment but only fail on 1.
- **Async notification via event queue**: rejected because the delay between contamination and notification allows unsafe phase transitions. Synchronous notification is essential.
- **No cascade depth limit**: rejected because real chemical systems can enter runaway failure states. The depth limit is a safety mechanism.
