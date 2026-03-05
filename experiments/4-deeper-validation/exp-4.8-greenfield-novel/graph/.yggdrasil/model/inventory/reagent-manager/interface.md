# Reagent Manager Interface

## Types

```typescript
interface ReagentRequirement {
  reagentId: string;
  quantity: number; // micrograms, positive integer
}

interface AllocationResult {
  success: boolean;
  allocatedReagents?: ReagentAllocation[];
  failedReagents?: FailedAllocation[];
}

interface ReagentAllocation {
  reagentId: string;
  quantity: number; // micrograms
  reservationId: string;
}

interface FailedAllocation {
  reagentId: string;
  requested: number; // micrograms
  available: number; // micrograms
}

interface ReagentInventory {
  reagentId: string;
  name: string;
  total: number; // micrograms
  reserved: number; // micrograms
  consumed: number; // micrograms
  available: number; // micrograms = total - reserved - consumed
}

interface AllocationRequest {
  recipeId: string;
  phaseId: string;
  priority: number; // lower = higher priority
  deadline: number; // epoch ms, phase deadline
  requirements: ReagentRequirement[];
}

interface InventoryEvent {
  type: 'released' | 'restocked' | 'consumed';
  reagentIds: string[];
  timestamp: number;
}
```

## Methods

- `allocateReagents(request: AllocationRequest): AllocationResult`
  - Synchronous. Attempts atomic allocation of all required reagents.
  - Returns `{ success: true, allocatedReagents }` if all reagents available.
  - Returns `{ success: false, failedReagents }` if any reagent insufficient. No partial allocation persists.
  - When two requests compete for the same scarce reagent, priority resolution: (1) lower priority number wins, (2) closer deadline wins, (3) earlier request arrival wins (FIFO).
  - Validates all quantities are positive integers. Throws `InvalidQuantityError` if any quantity is <= 0 or non-integer.
  - Throws `UnknownReagentError` if any reagentId is not in inventory.

- `releaseReagents(recipeId: string, phaseId: string): void`
  - Synchronous. Returns all reserved (not consumed) reagents for the given recipe+phase back to available.
  - No-op if no reservations exist for this recipe+phase (idempotent).
  - Emits `InventoryEvent { type: 'released' }` after release.

- `confirmConsumption(recipeId: string, phaseId: string): void`
  - Synchronous. Converts reserved quantities to consumed. Quantities permanently deducted.
  - Throws `NoReservationError` if no active reservations for this recipe+phase.
  - Emits `InventoryEvent { type: 'consumed' }`.

- `restock(reagentId: string, quantity: number): void`
  - Synchronous. Adds quantity (micrograms, positive integer) to total and available.
  - Throws `InvalidQuantityError` if quantity <= 0 or non-integer.
  - Throws `UnknownReagentError` if reagentId not in inventory.
  - Emits `InventoryEvent { type: 'restocked' }`.

- `addReagent(reagentId: string, name: string, initialQuantity: number): void`
  - Registers a new reagent in inventory with initial quantity.
  - Throws `DuplicateReagentError` if reagentId already exists.
  - Throws `InvalidQuantityError` if initialQuantity < 0 or non-integer.

- `getInventory(reagentId: string): ReagentInventory | undefined`
  - Returns current inventory state for a reagent, or undefined if not found.

- `getAllInventory(): ReagentInventory[]`
  - Returns inventory state for all reagents.

- `onInventoryChange(callback: (event: InventoryEvent) => void): void`
  - Registers a callback for inventory change events. Scheduler uses this to re-evaluate waiting recipes.

## Failure Modes

- **InvalidQuantityError**: Quantity is not a positive integer. Contains `{ field: string, value: number }`.
- **UnknownReagentError**: reagentId not found in inventory. Contains `{ reagentId: string }`.
- **DuplicateReagentError**: Attempted to add a reagent that already exists. Contains `{ reagentId: string }`.
- **NoReservationError**: Attempted to confirm consumption but no active reservation for this recipe+phase. Contains `{ recipeId: string, phaseId: string }`.
- **Inventory invariant violation**: `available` goes negative. Should never happen. If detected, throws `InventoryCorruptionError` and logs critical error. This indicates a bug, not a user error.
