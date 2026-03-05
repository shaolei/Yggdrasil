# Recipe Scheduler Internals

## Logic

### Execution Queue

Recipes are stored in a priority queue ordered by (priority ASC, submissionTime ASC). When equipment becomes available, the scheduler dequeues the highest-priority recipe whose next phase's equipment is free and whose reagents can be allocated.

The queue evaluation runs on two triggers:
1. Phase completion (equipment freed)
2. Reagent inventory change (allocation that previously failed may now succeed)

### Phase Transition Algorithm

```
onPhaseComplete(executionId, phaseIndex):
  1. Confirm consumption with reagent-manager (reserved -> consumed)
  2. Release equipment
  3. If phaseIndex == recipe.phases.length - 1:
     → recipe state = 'completed', record transition
  4. Else:
     nextPhase = recipe.phases[phaseIndex + 1]
     → attempt reagent allocation (atomic)
       → success: reserve equipment, start phase via phase-engine
       → failure (insufficient): recipe enters waiting_for_reagents
         → re-evaluate on inventory change events
     → check recipe timeout: if elapsed > recipe.timeout, abort
```

### Contamination Cascade Algorithm

```
handleContamination(event):
  if event.cascadeDepth > MAX_CASCADE_DEPTH (5):
    emergencyHalt()
    return

  affectedRecipes = activeRecipes.filter(r =>
    r.currentPhase.equipmentId === event.equipmentId
    && r.executionId !== event.sourceRecipeId
  )

  for each affected recipe (SYNCHRONOUS loop, no await):
    abort recipe → releases reagents, releases equipment
    if released equipment was in use by another recipe's phase:
      // this phase was sharing equipment? No — single-occupancy.
      // But aborting may cause this recipe's phase to fail if it was
      // in progress, which generates a NEW contamination event
      newEvent = { ...event, cascadeDepth: event.cascadeDepth + 1 }
      handleContamination(newEvent)  // recursive, depth-limited

  scheduleDecontamination(event.equipmentId)
```

### Equipment Booking

Equipment map: `Map<string, { recipeId: string, phaseId: string, until: number } | null>`

Booking is checked before phase start. Release happens on phase complete, phase abort, or contamination. Double-booking detected by checking map before write — if non-null and not the expected recipe, it is an invariant violation (emergency halt).

## State

- `executions: Map<string, RecipeExecution>` — all known executions by executionId
- `equipmentMap: Map<string, EquipmentBooking | null>` — current equipment occupancy
- `systemHalted: boolean` — emergency halt flag
- `cascadeDepthCurrent: number` — tracks current cascade depth during a contamination event chain

## Decisions

- **Chose synchronous contamination handling over async event bus** because the contamination-propagation aspect requires same-tick notification. An async event bus would allow a contaminated recipe to proceed to its next phase between the event being raised and being handled. Rejected: async event bus with "freeze all" pre-notification — too complex, and freeze semantics are unclear.

- **Chose recursive cascade over iterative BFS** because the cascade is naturally recursive (contamination -> abort -> new contamination) and depth-limited to 5. BFS would require manually tracking the frontier. Rejected: iterative BFS — simpler in theory but the recursive structure matches the domain semantics (each contamination is a new event, not a batch).

- **Chose UUIDv4 for executionId over sequential integers** because executions may be distributed in the future, and sequential IDs leak information about system throughput. Rejected: sequential integers — simpler but not future-proof.
