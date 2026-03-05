# Reagent Manager Responsibility

Manages shared reagent inventory. Provides atomic allocation (all-or-nothing), reservation tracking, consumption confirmation, and return on failure. Enforces quantity integrity using integer micrograms.

**In scope:**

- **allocateReagents(requirements, recipeId, phaseId, priority, deadline)**: Atomically reserve all required reagents for a phase. If any reagent has insufficient available quantity, reserve none and return failure. Uses priority-based conflict resolution when multiple phases compete.
- **releaseReagents(recipeId, phaseId)**: Return reserved (not yet consumed) reagents to available inventory. Called on phase failure or recipe abort.
- **confirmConsumption(recipeId, phaseId)**: Convert reserved quantities to consumed. Quantities are permanently deducted from inventory. Called on phase success.
- **Inventory tracking**: Maintain per-reagent quantities: total, reserved, consumed, available (= total - reserved - consumed). All quantities in integer micrograms.
- **Restock**: Add new reagent quantities to inventory (operator action).
- **Inventory change notifications**: Emit events when available quantities change (after release, restock, or consumption), so the scheduler can re-evaluate waiting recipes.
- **Audit trail**: Record every allocation, release, consumption, and restock with timestamp, recipeId, phaseId, and quantities.

**Out of scope:**

- Chemical compatibility checking (whether reagents can safely be combined) — external concern
- Reagent procurement or ordering — external concern
- Physical reagent dispensing — this is a logical inventory system, not hardware control
- Recipe scheduling or phase management (orchestrator/scheduler)
