# Reagent Manager Internals

## Logic

### Atomic Allocation Algorithm

```
allocateReagents(request):
  // Phase 1: Check availability for all reagents
  for each requirement in request.requirements:
    reagent = inventory.get(requirement.reagentId)
    if !reagent: throw UnknownReagentError
    if requirement.quantity <= 0 || !Number.isInteger(requirement.quantity):
      throw InvalidQuantityError
    if reagent.available < requirement.quantity:
      // Check if pending reservations by lower-priority requests could be preempted
      // NO — reagent-atomicity aspect forbids borrowing. Reserved = unavailable.
      failedList.push({ reagentId, requested, available: reagent.available })

  if failedList.length > 0:
    return { success: false, failedReagents: failedList }

  // Phase 2: All checks passed — allocate atomically
  reservations = []
  for each requirement in request.requirements:
    reagent = inventory.get(requirement.reagentId)
    reagent.reserved += requirement.quantity
    reagent.available -= requirement.quantity
    reservations.push({
      reagentId: requirement.reagentId,
      quantity: requirement.quantity,
      reservationId: generateReservationId()
    })

  // Phase 3: Record reservation for later release/consumption
  activeReservations.set(key(recipeId, phaseId), reservations)

  return { success: true, allocatedReagents: reservations }
```

The two-phase approach (check all, then allocate all) ensures atomicity. Since all methods are synchronous and Node.js is single-threaded, no lock is needed — the check and allocate happen in the same event loop iteration with no await in between.

### Priority Resolution

When a higher-priority request fails allocation, it does NOT preempt existing reservations. The reagent-atomicity aspect forbids borrowing. Instead, the scheduler is responsible for not starting lower-priority recipes when higher-priority ones are waiting. Priority resolution only applies at the scheduler level (queue ordering), not at the reagent-manager level.

The priority and deadline fields in AllocationRequest exist for audit/logging purposes, not for preemption logic within the reagent manager.

### Reservation Tracking

```
activeReservations: Map<string, ReagentAllocation[]>
  key: `${recipeId}:${phaseId}`
  value: array of individual reagent reservations
```

On release: iterate reservations, add quantities back to available, remove from reserved. On consumption: move quantities from reserved to consumed (no change to available).

## State

- `reagents: Map<string, ReagentInventory>` — per-reagent quantities
- `activeReservations: Map<string, ReagentAllocation[]>` — keyed by "recipeId:phaseId"
- `auditLog: AuditEntry[]` — append-only log of all operations
- `changeCallbacks: Array<(event: InventoryEvent) => void>` — registered listeners

## Constraints

- All quantities are non-negative integers (micrograms). The system must reject any operation that would make a quantity negative.
- `available = total - reserved - consumed` must hold at all times. This is recalculated, not stored independently, to prevent drift. The `available` getter computes it from the other three.
- No floating-point operations on quantities. All arithmetic is integer addition/subtraction.

## Decisions

- **Chose computed `available` over stored `available`** because storing it creates a drift risk (three fields that must stay in sync). Computing `total - reserved - consumed` is trivially cheap and always correct. Rejected: stored `available` with consistency checks — adds complexity for no benefit.

- **Chose synchronous (non-async) API over async** because Node.js single-threaded execution guarantees atomicity without locks for synchronous code. Introducing async would require explicit locking to prevent interleaving between the check and allocate phases. Rejected: async with mutex — unnecessary complexity in single-threaded runtime.

- **Chose NOT to implement preemption at reagent-manager level** because preemption creates circular dependencies (preempt reagent -> abort recipe -> release equipment -> reallocate). The scheduler handles priority at a higher level where it can reason about the full system state. Rejected: reagent-level preemption — elegant in theory, deadlock-prone in practice.
